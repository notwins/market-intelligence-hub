# V4 headline explorer — 3 November 2026
Display-only enhancement for saved daily headline cards (including overview, Reuters coverage and policy cards using newsRows). Does not change source schedules, feed history or article bodies.

## Facets and provenance
Country/region, central bank, sector, topic/subtopic, people/administration, share ticker. The full supported map is visible in Reuters Coverage. Tags come from whole-word/phrase matches in the headline or existing ticker metadata. Tags are navigation aids, not verified article-body classification. No company-to-country or ambiguous company-name-to-ticker inference. Filters combine across dimensions; Reset clears them. Original category and source date remain visible.

Colors supplement explicit text labels. US, Trump, FED/Fed, MAS and named central bank acronyms receive keyword accents without changing wording or original source anchors. Native details/summary controls allow keyboard expansion; filters have labels, 44px controls and narrow-screen layouts.

## Summary contract
Only a saved nonempty summary with summary_verified:true and a valid HTTPS summary_source_url is eligible for the summary section. These fields must be populated by a separate source-verification process before publication; the display flag itself does not verify claims. Current headline-only records show a missing-summary notice. No article details, quotations or figures are invented.

Teach Me is separately labelled general education, not article-specific analysis. It offers source-linked Fed/MAS or bond concepts and explicitly hypothetical/reading examples. Sources were checked on 3 November:
- https://www.federalreserve.gov/monetarypolicy.htm
- https://www.mas.gov.sg/monetary-policy
- https://www.investor.gov/introduction-investing/investing-basics/investment-products/bonds-or-fixed-income-products/bonds

## Validation
node scripts/test_headlines.cjs tests facets, ambiguous substrings, filters, escaping, missing and verified summaries, unsafe URLs, source attribution, education separation and V4 integration. Existing Python, V3/V4, Morningstar and mobile tests also pass. Chromium cannot launch under this executor's socket restrictions; visual browser QA is not claimed.
