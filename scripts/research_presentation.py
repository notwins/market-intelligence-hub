"""Explicit display-copy corrections; no research facts, figures or source links change.

The additive-report preservation check reverses only these exact approved edits
before checking the original baseline hash. Unlisted changes still fail it.
"""
COPY_CORRECTIONS = [
    ('<title>Market understanding | 31 October 2026</title>',
     '<title>Research Explained | Market Intelligence Hub</title>'),
    ('MARKET UPDATE / UNDERSTANDING THE EVIDENCE',
     'RESEARCH EXPLAINED / READINGS, RESEARCH &amp; EXPLANATIONS'),
    ('Evidence images are rendered from the uploaded originals. Complete PDFs remain on their publishers’ websites. The JPMorgan PDF URLs roll forward; a future click can open a newer edition, while this briefing’s screenshot captions retain their original dates.',
     'This page provides explanations and dated source references. Publisher images, slides and full PDFs are not hosted here. Open the original documents on their publishers’ websites. Rolling PDF links may show a newer edition; the reference captions retain the edition and page reviewed.'),
    ('Definitions and disclosures accompanying the JPMorgan slides',
     'Publisher definitions, disclosures &amp; source links'),
    ('The full original slides retain their branding, numbers and footnotes. Commentary is outside the images. The publisher’s FAQ requires attribution, unaltered slides and the relevant back-of-book disclosure pages when slides are used in presentations or written commentary. The following pages accompany the selected excerpts; no full report is included.',
     'The links below point to definition and disclosure pages in the publisher-hosted reports. No slides, screenshots or disclosure-page images are reproduced here. Read the original definitions, footnotes and usage guidance with the source material. The linked PDFs may roll forward to later editions.'),
    ('Open the six original definition and disclosure pages',
     'Six publisher-hosted definition and disclosure page links'),
    ('When publishing source images, retain attribution and accompanying disclosure material and check the applicable publisher terms.',
     'Publisher images and full PDFs remain on their original websites; the source links above retain the reviewed editions and page references.'),
]


def correct_copy(text):
    if 'id="market-understanding"' in text:
        for before, after in COPY_CORRECTIONS:
            text = text.replace(before, after)
    return text


def original_copy(text):
    if 'id="market-understanding"' in text:
        for before, after in reversed(COPY_CORRECTIONS):
            text = text.replace(after, before)
    return text
