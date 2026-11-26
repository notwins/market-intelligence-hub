/* Decorative labels for filing tables. Regional groups use an icon, named markets use flags. */
(function (root) {
  'use strict';
  const paths = {
    map: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.4 2.5 3.6 5.5 3.6 9s-1.2 6.5-3.6 9c-2.4-2.5-3.6-5.5-3.6-9S9.6 5.5 12 3Z"/>',
    revenue: '<path d="M4 19h16M6 15v-3m6 3V8m6 7V5"/>',
    cash: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 12h.1m11.8 0h.1"/>',
    assets: '<path d="M12 3 3 8l9 5 9-5-9-5ZM3 12l9 5 9-5M3 16l9 5 9-5"/>',
    obligations: '<path d="M6 4h12v16l-3-2-3 2-3-2-3 2V4Zm3 5h6m-6 4h6"/>',
    treasury: '<path d="m3 9 9-5 9 5H3Zm2 10h14M7 9v7m5-7v7m5-7v7"/>',
    lease: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h.1m5.9 0h.1M9 11h.1m5.9 0h.1M10 21v-5h4v5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
    ratios: '<circle cx="7.5" cy="7.5" r="2"/><circle cx="16.5" cy="16.5" r="2"/><path d="M18 6 6 18"/>',
    shield: '<path d="M12 3 5 6v6c0 4 2.7 7.2 7 9 4.3-1.8 7-5 7-9V6l-7-3Zm-3 9 2 2 4-4"/>',
    flow: '<path d="M4 8h15m-3-3 3 3-3 3M20 16H5m3 3-3-3 3-3"/>',
    market: '<path d="M4 5v14h16M7 15l4-4 3 2 5-6m-4 0h4v4"/>'
  };
  const flags = {
    usa:'us', 'united states':'us','united states of america':'us', us:'us',
    china:'cn','prc':'cn','mainland china':'cn','chinese mainland':'cn','hong kong':'hk',japan:'jp',
    taiwan:'tw', singapore:'sg', korea:'kr','south korea':'kr','republic of korea':'kr',india:'in',
    indonesia:'id',malaysia:'my',thailand:'th',philippines:'ph',vietnam:'vn',australia:'au','new zealand':'nz',
    canada:'ca',mexico:'mx',brazil:'br',argentina:'ar','united kingdom':'gb','great britain':'gb',uk:'gb',
    germany:'de', france:'fr', italy:'it', spain:'es',sweden:'se',switzerland:'ch',poland:'pl',
    'saudi arabia':'sa','south africa':'za',libya:'ly'
  };
  function mark(name){
    return paths[name]?'<svg class="filing-row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+paths[name]+'</svg>':'';
  }
  function geography(label){
    const key=root.FilingGeography.normalize(label);
    const pair=/^china (hong kong|including hong kong|includes hong kong)$/.test(key);
    const codes=pair?['cn','hk']:Object.hasOwn(flags,key)?[flags[key]]:[];
    if(!codes.length)return mark('map');
    return '<span class="filing-flags" aria-hidden="true">'+codes.map(code=>
      '<img alt="" src="assets/news-flags/'+code+'.svg" width="16" height="12" loading="lazy">').join('')+'</span>';
  }
  function row(key,label){
    if(/^(?:quarter-)?(?:geo-|mix-geography-)/.test(key)){
      if(key==='quarter-geo-end')return mark('clock');
      if(key==='quarter-geo-disclosed')return mark('revenue');
      return geography(label);
    }
    if(/^due-|^asof-|firstdebt|shortdebtshare|duecash/i.test(key))return mark('clock');
    if(/lease/i.test(key))return mark('lease');
    if(/treasur|governmentdebt/i.test(key))return mark('treasury');
    if(/solvency|cet1|capitalratio|^score$/i.test(key))return mark('shield');
    if(/cashflow|cashconversion/i.test(key))return mark('flow');
    if(/ratio|margin|growth|yield|^roe$|^roa$/i.test(key))return mark('ratios');
    if(/cash/i.test(key))return mark('cash');
    if(/debt|liabilit/i.test(key))return mark('obligations');
    if(/assets|^equity$|^core-equity$/i.test(key))return mark('assets');
    if(/revenue|^netincome$|^operatingincome$|^core-(net|operating)income$/.test(key.toLowerCase()))return mark('revenue');
    if(/^(?:pettm|pefy|forwardpe|ev(?:ebit|$)|cap$|quoteprice|pricebook|pricesales)/i.test(key))return mark('market');
    return '';
  }
  root.FilingMarks={row,geography,mark};
})(window);

