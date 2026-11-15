# Light-only appearance, 15 November 2026

The owner explicitly requested publication of the reviewed compact cards and
plain labels, a darker non-neon purple, and that the entire website always use
light mode. This appearance-only migration supersedes the legacy byte freeze
only for disabling automatic dark styling and adding the light policy assets.

V3 theme 08 secondary ink is `#635E72`, with its `#FAF9FC` panel. Canonical
semantic IDs and the V1.2 workbook catalogue remain available unchanged; a
display stylesheet applies the owner's purple override. Charts and table
calculations are unchanged. Legacy HTML receipts and baseline hashes have been
reconciled to the new presentation bytes. Report narrative, figures, dates,
source links, downloads and independent content publishing remain intact.

`light-mode.js` selects light before rendering and rejects subsequent script or
cached-theme changes. Automatic dark media blocks and explicit dark selectors
are disabled. Dark swatches in the V3 reference remain labelled source samples;
they are not a page dark-mode option. A dark navigation accent is a colour on
the light interface, not a device-triggered dark theme.

Rollback must restore these explicit UI/style paths together with matching
appearance receipts on current main. Do not redeploy an older whole artifact or
remove newer independently published reports.
