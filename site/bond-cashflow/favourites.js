/* Portfolio exports identify favourites independently of position and cash data. */
window.BondStudioAdapter = {
  fromExport(raw, catalogue) {
    const state = raw?.state || raw;
    if (!Array.isArray(state?.quickFavourites))
      throw Error('Choose a Portfolio export with a quickFavourites list.');
    const ids = [
      ...new Set(state.quickFavourites.filter((id) => typeof id === 'string'))
    ];
    const rows = new Set(),
      unmatched = [];
    for (const id of ids) {
      const isin = id.replace(/^quick-/, '');
      const matches = catalogue.filter(
        (row) => row.id === id || row.isin === isin
      );
      if (matches.length === 1) rows.add(matches[0]);
      else unmatched.push(id);
    }
    return { rows: [...rows], matched: rows.size, unmatched };
  }
};
