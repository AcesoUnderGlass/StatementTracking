"""Tests for article/PDF fetching."""

from unittest.mock import MagicMock, patch

import pytest

from app.services.fetcher import (
    FetchError,
    _fetch_pdf_article,
    _is_pdf_url,
    _resolve_google_news_url,
    fetch_article,
)


class TestIsPdfUrl:
    def test_https_path_ending_pdf(self):
        assert _is_pdf_url("https://gov.example/reports/hearing.pdf") is True

    def test_case_insensitive_extension(self):
        assert _is_pdf_url("https://x.org/doc.PDF") is True

    def test_not_pdf(self):
        assert _is_pdf_url("https://news.example/article") is False


class TestFetchPdfArticle:
    @patch("app.services.fetcher.httpx.Client")
    def test_invalid_magic_raises(self, mock_client_cls):
        mock_response = MagicMock()
        mock_response.content = b"not a pdf file"
        mock_response.raise_for_status = MagicMock()
        mock_client = MagicMock()
        mock_client.get.return_value = mock_response
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client_cls.return_value = mock_client

        with pytest.raises(FetchError, match="%PDF"):
            _fetch_pdf_article("https://example.com/x.pdf")

    @patch("app.services.fetcher.httpx.Client")
    def test_extracts_text_and_title(self, mock_client_cls):
        pdf_bytes = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"
        mock_response = MagicMock()
        mock_response.content = pdf_bytes
        mock_response.raise_for_status = MagicMock()
        mock_client = MagicMock()
        mock_client.get.return_value = mock_response
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client_cls.return_value = mock_client

        mock_page = MagicMock()
        mock_page.extract_text.return_value = "x" * 120
        mock_reader = MagicMock()
        mock_reader.pages = [mock_page]
        mock_reader.metadata = None
        mock_reader.is_encrypted = False

        with patch("app.services.fetcher.PdfReader", return_value=mock_reader):
            out = _fetch_pdf_article("https://example.com/doc.pdf")

        assert out["url"] == "https://example.com/doc.pdf"
        assert len(out["text"]) >= 100
        assert out["title"] is None
        assert out["publication"] == "Example"


class TestFetchArticleRoutesToPdf:
    @patch("app.services.fetcher._fetch_pdf_article")
    def test_pdf_url_uses_pdf_branch(self, mock_pdf):
        mock_pdf.return_value = {
            "title": "T",
            "text": "y" * 100,
            "publication": "P",
            "published_date": None,
            "url": "https://a.com/x.pdf",
        }
        fetch_article("https://a.com/x.pdf")
        mock_pdf.assert_called_once_with("https://a.com/x.pdf")


_GNEWS_URL = (
    "https://news.google.com/rss/articles/"
    "CBMi6AFBVV95cUxPSUtwbVV4Umo0YmUyUmo2NXM5SEI2N3NqOGg0?oc=5"
)
_GNEWS_READ_URL = (
    "https://news.google.com/articles/"
    "CBMi6AFBVV95cUxPSUtwbVV4Umo0YmUyUmo2NXM5SEI2N3NqOGg0?oc=5"
)
_REAL_ARTICLE_URL = "https://www.reuters.com/technology/ai-policy-update-2025/"


class TestResolveGoogleNewsUrl:
    def test_non_google_url_returns_none(self):
        assert _resolve_google_news_url("https://reuters.com/article/123") is None

    @patch("googlenewsdecoder.gnewsdecoder")
    def test_successful_decode(self, mock_decoder):
        mock_decoder.return_value = {
            "status": True,
            "decoded_url": _REAL_ARTICLE_URL,
        }
        result = _resolve_google_news_url(_GNEWS_URL)
        assert result == _REAL_ARTICLE_URL
        mock_decoder.assert_called_once_with(_GNEWS_URL, interval=None)

    @patch("googlenewsdecoder.gnewsdecoder")
    def test_matches_read_style_urls(self, mock_decoder):
        mock_decoder.return_value = {
            "status": True,
            "decoded_url": _REAL_ARTICLE_URL,
        }
        result = _resolve_google_news_url(_GNEWS_READ_URL)
        assert result == _REAL_ARTICLE_URL

    @patch("googlenewsdecoder.gnewsdecoder")
    def test_decode_failure_returns_none(self, mock_decoder):
        mock_decoder.return_value = {"status": False, "message": "decode error"}
        assert _resolve_google_news_url(_GNEWS_URL) is None

    @patch("googlenewsdecoder.gnewsdecoder", side_effect=Exception("network"))
    def test_exception_returns_none(self, mock_decoder):
        assert _resolve_google_news_url(_GNEWS_URL) is None


class TestFetchArticleResolvesGoogleNews:
    @patch("app.services.fetcher._fetch_html_article")
    @patch("app.services.fetcher._resolve_google_news_url")
    def test_google_news_url_resolved_before_fetch(self, mock_resolve, mock_html):
        mock_resolve.return_value = _REAL_ARTICLE_URL
        mock_html.return_value = {
            "title": "AI Policy Update",
            "text": "z" * 200,
            "publication": "Reuters",
            "published_date": None,
            "url": _REAL_ARTICLE_URL,
        }
        result = fetch_article(_GNEWS_URL)
        mock_resolve.assert_called_once_with(_GNEWS_URL)
        mock_html.assert_called_once_with(_REAL_ARTICLE_URL)
        assert result["url"] == _REAL_ARTICLE_URL

    @patch("app.services.fetcher._fetch_html_article")
    @patch("app.services.fetcher._resolve_google_news_url")
    def test_unresolvable_google_url_falls_through(self, mock_resolve, mock_html):
        mock_resolve.return_value = None
        mock_html.side_effect = FetchError("Article text is too short or empty")
        with pytest.raises(FetchError, match="too short"):
            fetch_article(_GNEWS_URL)
        mock_html.assert_called_once_with(_GNEWS_URL)
