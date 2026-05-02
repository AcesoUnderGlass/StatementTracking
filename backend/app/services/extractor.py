import json
import os
from typing import List

import anthropic
from dotenv import load_dotenv

load_dotenv()

ARTICLE_SYSTEM_PROMPT = (
    "You are extracting direct quotes from news articles. Return only exact quoted "
    "speech (text that appears in quotation marks in the original article) from "
    "policymakers, government officials, government institutions, think tanks, or "
    "their staff members, where the quote discusses artificial intelligence in any "
    "context. For each quote return: the full quoted text, the name and title of the "
    "speaker as identified in the article, the speaker_type classification, and one "
    "to two sentences of surrounding context. "
    "speaker_type must be one of: 'elected' (elected officials), 'staff' (government "
    "or organizational staff), 'think_tank' (think tanks or research organizations), "
    "'gov_inst' (government agencies or institutions), or 'commercial' (private-sector "
    "executives, tech industry leaders, and corporate spokespeople — e.g. Bill Gates, "
    "Sam Altman, Elon Musk). When the quote is attributed "
    "to an organization rather than a named individual, use the organization name as "
    "speaker_name and its description as speaker_title. "
    "News articles frequently interrupt a single continuous quote with attribution text "
    "(e.g. 'said Senator X' or 'she continued'). When a speaker's quoted text is "
    "interrupted by attribution but resumes in the same paragraph or immediately "
    "following, treat the full statement as one quote. Reassemble the fragments into a "
    "single quote_text field, separated by an ellipsis where the attribution "
    "interruption occurred. Only treat two quotes from the same speaker as separate "
    "entries if they are clearly distinct statements made at different points in the "
    "article. "
    "For each quote, also assign jurisdiction tags describing the subject matter of "
    "the statement (NOT the speaker's location or identity). Choose exclusively from "
    "the canonical list provided in the user message below. When a specific US state is "
    "relevant, tag both the state name and 'US-state'. When a specific US city or "
    "county is relevant, tag both the locality name and 'US-local'. "
    "IMPORTANT: 'US-local' is ONLY for US cities and counties. For non-US countries "
    "(e.g. China, Japan, India, EU member states), use the country's canonical tag — "
    "never 'US-local'. "
    "Only create a new "
    "tag if absolutely nothing in the canonical list fits; never create synonyms of "
    "existing tags. Return jurisdictions as an array of tag name strings. "
    "For each quote, also assign topic tags describing what the quote is about. "
    "Strongly prefer tags from the canonical topic list provided in the user message. "
    "A quote may have more than one topic. Only create a new topic tag if absolutely "
    "nothing in the canonical list fits; never create synonyms of existing tags. "
    "Return topics as an array of tag name strings. "
    "MULTILINGUAL HANDLING: If the source text is in a language other than English, "
    "provide an English translation of each quote as quote_text, and include the "
    "original-language text in original_quote_text. For speaker names in non-Latin "
    "scripts, provide the romanized form in speaker_name and add the original script "
    "form in parentheses (e.g. 'Zhang Wei (张伟)'). Write the context field in English. "
    "If the source is already in English, set original_quote_text to null. "
    "Return a JSON object only, no other "
    'text. Schema: { "quotes": [{ "speaker_name": string, "speaker_title": string, '
    '"speaker_type": string, "quote_text": string, "original_quote_text": string | null, '
    '"context": string, "jurisdictions": string[], "topics": string[] }] }'
)

TRANSCRIPT_SYSTEM_PROMPT = (
    "You are extracting notable, substantive statements about artificial intelligence "
    "from a YouTube video transcript. The transcript is spoken word — there are no "
    "quotation marks. Your job is to identify the most meaningful AI-related statements "
    "made by speakers in the video. "
    "Use the VIDEO DESCRIPTION and video title (provided in the user message) to "
    "identify who is speaking. If the video is an interview or panel, use contextual "
    "clues (introductions, name mentions, 'you said', etc.) to attribute statements to "
    "specific speakers. If the speaker cannot be determined, use the channel name or "
    "'Unknown Speaker'. "
    "Focus on statements from policymakers, government officials, government "
    "institutions, think tanks, industry leaders, or their staff members. "
    "For each extracted statement return: the substantive text (cleaned up for "
    "readability — remove filler words and false starts, but preserve the speaker's "
    "meaning and wording), the speaker's name and title as best you can determine, "
    "the speaker_type classification, and one to two sentences of context about what "
    "was being discussed. "
    "speaker_type must be one of: 'elected' (elected officials), 'staff' (government "
    "or organizational staff), 'think_tank' (think tanks or research organizations), "
    "'gov_inst' (government agencies or institutions), or 'commercial' (private-sector "
    "executives, tech industry leaders, and corporate spokespeople). If the speaker does "
    "not fit these categories (e.g. a journalist), still extract the quote but use "
    "the closest matching type. "
    "Merge consecutive sentences from the same speaker on the same point into a single "
    "quote. Only create separate entries for clearly distinct statements or topics. "
    "For each quote, also assign jurisdiction tags describing the subject matter of "
    "the statement (NOT the speaker's location or identity). Choose exclusively from "
    "the canonical list provided in the user message below. When a specific US state is "
    "relevant, tag both the state name and 'US-state'. When a specific US city or "
    "county is relevant, tag both the locality name and 'US-local'. "
    "IMPORTANT: 'US-local' is ONLY for US cities and counties. For non-US countries "
    "(e.g. China, Japan, India, EU member states), use the country's canonical tag — "
    "never 'US-local'. "
    "Only create a new "
    "tag if absolutely nothing in the canonical list fits; never create synonyms of "
    "existing tags. Return jurisdictions as an array of tag name strings. "
    "For each quote, also assign topic tags describing what the quote is about. "
    "Strongly prefer tags from the canonical topic list provided in the user message. "
    "A quote may have more than one topic. Only create a new topic tag if absolutely "
    "nothing in the canonical list fits; never create synonyms of existing tags. "
    "Return topics as an array of tag name strings. "
    "MULTILINGUAL HANDLING: If the source text is in a language other than English, "
    "provide an English translation of each quote as quote_text, and include the "
    "original-language text in original_quote_text. For speaker names in non-Latin "
    "scripts, provide the romanized form in speaker_name and add the original script "
    "form in parentheses (e.g. 'Zhang Wei (张伟)'). Write the context field in English. "
    "If the source is already in English, set original_quote_text to null. "
    "Return a JSON object only, no other "
    'text. Schema: { "quotes": [{ "speaker_name": string, "speaker_title": string, '
    '"speaker_type": string, "quote_text": string, "original_quote_text": string | null, '
    '"context": string, "jurisdictions": string[], "topics": string[] }] }'
)

PAGE_TRANSCRIPT_SYSTEM_PROMPT = (
    "You are extracting notable, substantive statements about artificial intelligence "
    "from a written transcript. The page is a transcript of one or more speakers — "
    "a hearing, press conference, interview, speech, panel discussion, or similar. "
    "The entire content is quotable; do NOT look for quotation marks. "
    "Speakers are typically identified by labels at the start of their passages "
    "(e.g. 'SENATOR SMITH:', 'Mr. Jones:', 'Chairman Powell:', 'Q:', 'A:', or similar "
    "patterns). Use these labels to attribute each statement to its correct speaker. "
    "When names appear in ALL CAPS in the label, normalize them to standard title case "
    "in the speaker_name field (e.g. 'MR. ZUCKERBERG' → 'Mark Zuckerberg' if the full "
    "name is available elsewhere in the transcript, otherwise 'Mr. Zuckerberg'). "
    "If a title or role is stated in the transcript (introductions, headers, or context "
    "lines), use it for speaker_title. "
    "Focus on statements from policymakers, government officials, government "
    "institutions, think tanks, industry leaders, or their staff members. "
    "For each extracted statement return: the substantive text (cleaned up for "
    "readability — remove filler words, false starts, and procedural boilerplate like "
    "'I yield back' or 'thank you Mr. Chairman', but preserve the speaker's meaning "
    "and wording), the speaker's name and title, the speaker_type classification, and "
    "one to two sentences of context about what was being discussed. "
    "speaker_type must be one of: 'elected' (elected officials), 'staff' (government "
    "or organizational staff), 'think_tank' (think tanks or research organizations), "
    "'gov_inst' (government agencies or institutions), or 'commercial' (private-sector "
    "executives, tech industry leaders, and corporate spokespeople). If the speaker does "
    "not fit these categories (e.g. a journalist), still extract the quote but use "
    "the closest matching type. "
    "Merge consecutive sentences from the same speaker on the same point into a single "
    "quote. Only create separate entries for clearly distinct statements or topics from "
    "the same speaker, or when a different speaker begins. "
    "For each quote, also assign jurisdiction tags describing the subject matter of "
    "the statement (NOT the speaker's location or identity). Choose exclusively from "
    "the canonical list provided in the user message below. When a specific US state is "
    "relevant, tag both the state name and 'US-state'. When a specific US city or "
    "county is relevant, tag both the locality name and 'US-local'. "
    "IMPORTANT: 'US-local' is ONLY for US cities and counties. For non-US countries "
    "(e.g. China, Japan, India, EU member states), use the country's canonical tag — "
    "never 'US-local'. "
    "Only create a new "
    "tag if absolutely nothing in the canonical list fits; never create synonyms of "
    "existing tags. Return jurisdictions as an array of tag name strings. "
    "For each quote, also assign topic tags describing what the quote is about. "
    "Strongly prefer tags from the canonical topic list provided in the user message. "
    "A quote may have more than one topic. Only create a new topic tag if absolutely "
    "nothing in the canonical list fits; never create synonyms of existing tags. "
    "Return topics as an array of tag name strings. "
    "MULTILINGUAL HANDLING: If the source text is in a language other than English, "
    "provide an English translation of each quote as quote_text, and include the "
    "original-language text in original_quote_text. For speaker names in non-Latin "
    "scripts, provide the romanized form in speaker_name and add the original script "
    "form in parentheses (e.g. 'Zhang Wei (张伟)'). Write the context field in English. "
    "If the source is already in English, set original_quote_text to null. "
    "Return a JSON object only, no other "
    'text. Schema: { "quotes": [{ "speaker_name": string, "speaker_title": string, '
    '"speaker_type": string, "quote_text": string, "original_quote_text": string | null, '
    '"context": string, "jurisdictions": string[], "topics": string[] }] }'
)

PRESS_STATEMENT_SYSTEM_PROMPT = (
    "You are extracting notable, substantive statements about artificial intelligence "
    "from an official document written in a single voice — such as a press release, "
    "executive order, policy statement, fact sheet, open letter, or similar. "
    "The entire page is attributable to one author or issuing authority; there are no "
    "separate quoted sources to look for. The full text is quotable — do NOT rely on "
    "quotation marks. "
    "Identify the author or issuing authority from bylines, headers, signatures, "
    "organizational branding, or contextual clues on the page. Use that as the "
    "speaker_name. If the document is issued by an organization (e.g. 'The White House', "
    "'Department of Commerce') rather than a named individual, use the organization name "
    "as speaker_name and its description as speaker_title. If both an individual and an "
    "organization are identified, prefer the individual as speaker_name with the "
    "organization in speaker_title. "
    "Focus on substantive AI-related policy positions, commitments, announcements, "
    "directives, proposals, and analysis. Skip purely procedural, boilerplate, or "
    "administrative language. "
    "For each extracted statement return: the substantive text (preserving the author's "
    "meaning and wording), the author's name and title, the speaker_type classification, "
    "and one to two sentences of context about what the statement addresses. "
    "speaker_type must be one of: 'elected' (elected officials), 'staff' (government "
    "or organizational staff), 'think_tank' (think tanks or research organizations), "
    "'gov_inst' (government agencies or institutions), or 'commercial' (private-sector "
    "executives, tech industry leaders, and corporate spokespeople). If the author does "
    "not fit these categories, still extract the statement but use the closest matching type. "
    "Merge consecutive sentences on the same point into a single quote. Only create "
    "separate entries for clearly distinct policy points, announcements, or topics "
    "within the document. "
    "For each quote, also assign jurisdiction tags describing the subject matter of "
    "the statement (NOT the speaker's location or identity). Choose exclusively from "
    "the canonical list provided in the user message below. When a specific US state is "
    "relevant, tag both the state name and 'US-state'. When a specific US city or "
    "county is relevant, tag both the locality name and 'US-local'. "
    "IMPORTANT: 'US-local' is ONLY for US cities and counties. For non-US countries "
    "(e.g. China, Japan, India, EU member states), use the country's canonical tag — "
    "never 'US-local'. "
    "Only create a new "
    "tag if absolutely nothing in the canonical list fits; never create synonyms of "
    "existing tags. Return jurisdictions as an array of tag name strings. "
    "For each quote, also assign topic tags describing what the quote is about. "
    "Strongly prefer tags from the canonical topic list provided in the user message. "
    "A quote may have more than one topic. Only create a new topic tag if absolutely "
    "nothing in the canonical list fits; never create synonyms of existing tags. "
    "Return topics as an array of tag name strings. "
    "MULTILINGUAL HANDLING: If the source text is in a language other than English, "
    "provide an English translation of each quote as quote_text, and include the "
    "original-language text in original_quote_text. For speaker names in non-Latin "
    "scripts, provide the romanized form in speaker_name and add the original script "
    "form in parentheses (e.g. 'Zhang Wei (张伟)'). Write the context field in English. "
    "If the source is already in English, set original_quote_text to null. "
    "Return a JSON object only, no other "
    'text. Schema: { "quotes": [{ "speaker_name": string, "speaker_title": string, '
    '"speaker_type": string, "quote_text": string, "original_quote_text": string | null, '
    '"context": string, "jurisdictions": string[], "topics": string[] }] }'
)

TWEET_SYSTEM_PROMPT = (
    "You are extracting a statement about artificial intelligence from a single "
    "tweet (post on X/Twitter). The tweet text IS the statement — there are no "
    "quotation marks to look for. "
    "The author's name and handle are provided above the tweet text. Use the "
    "author name as speaker_name. If their role or title is evident from the "
    "tweet or their handle (e.g. a known politician, agency, or think tank), "
    "infer speaker_title; otherwise set it to null. "
    "speaker_type must be one of: 'elected' (elected officials), 'staff' (government "
    "or organizational staff), 'think_tank' (think tanks or research organizations), "
    "'gov_inst' (government agencies or institutions), or 'commercial' (private-sector "
    "executives, tech industry leaders, and corporate spokespeople). If the author does "
    "not fit these categories, still extract the statement but use the closest matching type. "
    "Treat the entire tweet as a single quotable statement. Only split into multiple "
    "entries if the tweet clearly makes two unrelated points about AI. "
    "Clean up the text for readability (e.g. expand common abbreviations if ambiguous) "
    "but preserve the author's wording. Remove hashtags only if they are not part of "
    "the substantive meaning. Preserve @-mentions. "
    "For each quote, also assign jurisdiction tags describing the subject matter of "
    "the statement (NOT the speaker's location or identity). Choose exclusively from "
    "the canonical list provided in the user message below. When a specific US state is "
    "relevant, tag both the state name and 'US-state'. When a specific US city or "
    "county is relevant, tag both the locality name and 'US-local'. "
    "IMPORTANT: 'US-local' is ONLY for US cities and counties. For non-US countries "
    "(e.g. China, Japan, India, EU member states), use the country's canonical tag — "
    "never 'US-local'. "
    "Only create a new "
    "tag if absolutely nothing in the canonical list fits; never create synonyms of "
    "existing tags. Return jurisdictions as an array of tag name strings. "
    "For each quote, also assign topic tags describing what the quote is about. "
    "Strongly prefer tags from the canonical topic list provided in the user message. "
    "A quote may have more than one topic. Only create a new topic tag if absolutely "
    "nothing in the canonical list fits; never create synonyms of existing tags. "
    "Return topics as an array of tag name strings. "
    "MULTILINGUAL HANDLING: If the source text is in a language other than English, "
    "provide an English translation of each quote as quote_text, and include the "
    "original-language text in original_quote_text. For speaker names in non-Latin "
    "scripts, provide the romanized form in speaker_name and add the original script "
    "form in parentheses (e.g. 'Zhang Wei (张伟)'). Write the context field in English. "
    "If the source is already in English, set original_quote_text to null. "
    "Return a JSON object only, no other "
    'text. Schema: { "quotes": [{ "speaker_name": string, "speaker_title": string, '
    '"speaker_type": string, "quote_text": string, "original_quote_text": string | null, '
    '"context": string, "jurisdictions": string[], "topics": string[] }] }'
)

SOCIAL_POST_SYSTEM_PROMPT = (
    "You are extracting a statement about artificial intelligence from a single "
    "social media post. The post text IS the statement — there are no "
    "quotation marks to look for. "
    "The author's name and handle are provided above the post text. Use the "
    "author name as speaker_name. If their role or title is evident from the "
    "post or their handle (e.g. a known politician, agency, or think tank), "
    "infer speaker_title; otherwise set it to null. "
    "speaker_type must be one of: 'elected' (elected officials), 'staff' (government "
    "or organizational staff), 'think_tank' (think tanks or research organizations), "
    "'gov_inst' (government agencies or institutions), or 'commercial' (private-sector "
    "executives, tech industry leaders, and corporate spokespeople). If the author does "
    "not fit these categories, still extract the statement but use the closest matching type. "
    "Treat the entire post as a single quotable statement. Only split into multiple "
    "entries if the post clearly makes two unrelated points about AI. "
    "Clean up the text for readability (e.g. expand common abbreviations if ambiguous) "
    "but preserve the author's wording. Remove hashtags only if they are not part of "
    "the substantive meaning. Preserve @-mentions and handles. "
    "For each quote, also assign jurisdiction tags describing the subject matter of "
    "the statement (NOT the speaker's location or identity). Choose exclusively from "
    "the canonical list provided in the user message below. When a specific US state is "
    "relevant, tag both the state name and 'US-state'. When a specific US city or "
    "county is relevant, tag both the locality name and 'US-local'. "
    "IMPORTANT: 'US-local' is ONLY for US cities and counties. For non-US countries "
    "(e.g. China, Japan, India, EU member states), use the country's canonical tag — "
    "never 'US-local'. "
    "Only create a new "
    "tag if absolutely nothing in the canonical list fits; never create synonyms of "
    "existing tags. Return jurisdictions as an array of tag name strings. "
    "For each quote, also assign topic tags describing what the quote is about. "
    "Strongly prefer tags from the canonical topic list provided in the user message. "
    "A quote may have more than one topic. Only create a new topic tag if absolutely "
    "nothing in the canonical list fits; never create synonyms of existing tags. "
    "Return topics as an array of tag name strings. "
    "MULTILINGUAL HANDLING: If the source text is in a language other than English, "
    "provide an English translation of each quote as quote_text, and include the "
    "original-language text in original_quote_text. For speaker names in non-Latin "
    "scripts, provide the romanized form in speaker_name and add the original script "
    "form in parentheses (e.g. 'Zhang Wei (张伟)'). Write the context field in English. "
    "If the source is already in English, set original_quote_text to null. "
    "Return a JSON object only, no other "
    'text. Schema: { "quotes": [{ "speaker_name": string, "speaker_title": string, '
    '"speaker_type": string, "quote_text": string, "original_quote_text": string | null, '
    '"context": string, "jurisdictions": string[], "topics": string[] }] }'
)

SYSTEM_PROMPT = ARTICLE_SYSTEM_PROMPT


class ExtractionError(Exception):
    pass


_LANGUAGE_NAMES = {
    "zh": "Chinese",
    "ja": "Japanese",
    "ko": "Korean",
}


def extract_quotes(
    article_text: str,
    canonical_jurisdiction_list: str,
    canonical_topic_list: str = "",
    source_type: str = "article",
    language: str = "en",
) -> List[dict]:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ExtractionError("ANTHROPIC_API_KEY is not set in environment.")

    client = anthropic.Anthropic(api_key=api_key)

    if source_type == "youtube_transcript":
        system_prompt = TRANSCRIPT_SYSTEM_PROMPT
        extract_instruction = (
            "Extract all notable AI-related statements from the following "
            "YouTube video transcript:"
        )
    elif source_type == "page_transcript":
        system_prompt = PAGE_TRANSCRIPT_SYSTEM_PROMPT
        extract_instruction = (
            "Extract all notable AI-related statements from the following "
            "transcript:"
        )
    elif source_type == "press_statement":
        system_prompt = PRESS_STATEMENT_SYSTEM_PROMPT
        extract_instruction = (
            "Extract all notable AI-related statements from the following "
            "official document:"
        )
    elif source_type == "tweet":
        system_prompt = TWEET_SYSTEM_PROMPT
        extract_instruction = (
            "Extract the AI-related statement from the following tweet:"
        )
    elif source_type == "bluesky_post":
        system_prompt = SOCIAL_POST_SYSTEM_PROMPT
        extract_instruction = (
            "Extract the AI-related statement from the following Bluesky post:"
        )
    elif source_type == "facebook_post":
        system_prompt = SOCIAL_POST_SYSTEM_PROMPT
        extract_instruction = (
            "Extract the AI-related statement from the following Facebook post:"
        )
    else:
        system_prompt = ARTICLE_SYSTEM_PROMPT
        extract_instruction = (
            "Extract all direct AI-related quotes from the following article:"
        )

    language_note = ""
    if language and language != "en":
        lang_name = _LANGUAGE_NAMES.get(language, language)
        language_note = (
            f"NOTE: The following content is in {lang_name}. Extract quotes "
            "in the original language as original_quote_text and provide "
            "accurate English translations as quote_text.\n\n"
        )

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            temperature=0,
            system=system_prompt,
            messages=[
                {
                    "role": "user",
                    "content": (
                        "Canonical jurisdiction tag names (choose only from this list "
                        "unless no entry fits; use the exact name string, not synonyms):\n\n"
                        f"{canonical_jurisdiction_list}\n\n"
                        "Canonical topic tag names (strongly prefer tags from this list; "
                        "only create a new tag if nothing fits):\n\n"
                        f"{canonical_topic_list}\n\n"
                        f"{language_note}"
                        f"{extract_instruction}\n\n"
                        f"{article_text}"
                    ),
                }
            ],
        )
    except anthropic.APIError as e:
        raise ExtractionError(f"Anthropic API error: {e}")

    raw_text = response.content[0].text.strip()

    if raw_text.startswith("```"):
        lines = raw_text.split("\n")
        lines = [l for l in lines if not l.startswith("```")]
        raw_text = "\n".join(lines)

    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError:
        raise ExtractionError(
            f"Failed to parse LLM response as JSON. Raw response: {raw_text[:500]}"
        )

    if "quotes" not in data:
        raise ExtractionError("LLM response missing 'quotes' key.")

    return data["quotes"]
