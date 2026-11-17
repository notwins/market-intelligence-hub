/* Prior-only sigma helpers. No pooling, resampling, interpolation or implicit zeroes.
 * transform(points, mode, frequency) -> [{date,raw,value,reason}].
 * analyze(points,{transform,frequency,years,minN,excludeDates}) adds mean/sd/n/z/baselineStart.
 * points are one homogeneous series [[ISO date, finite number|null],...].
 * Years are calendar windows, inclusive lower bound; observation itself excluded.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FredSigma = api;
})(typeof window === 'object' ? window : null, function () {
  'use strict';
  const DAY = 86400000;
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  function shiftYear(date, years) {
    const year = Number(date.slice(0,4)) - years, month = Number(date.slice(5,7)), day = Number(date.slice(8,10));
    const last = new Date(Date.UTC(year,month,0)).getUTCDate();
    return `${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(Math.min(day,last)).padStart(2,'0')}`;
  }
  function normalize(points) {
    const result = points.map(point => {
      const date = String(point[0]);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date + 'T00:00:00Z')) || new Date(date + 'T00:00:00Z').toISOString().slice(0,10) !== date) throw Error('Invalid observation date');
      return {date,raw:finite(point[1]) ? point[1] : null};
    }).sort((a,b) => a.date.localeCompare(b.date));
    for (let i=1;i<result.length;i++) if (result[i].date === result[i-1].date) throw Error('Duplicate dates: choose a single homogeneous series before calculating sigma');
    return result;
  }
  function transform(points, mode='level', frequency='', options={}) {
    if (!['level','yoy','year_change'].includes(mode)) throw Error('Unknown heat transform');
    const rows = normalize(points), byDate = new Map(rows.map(row => [row.date,row])), excluded=new Set(options.excludeDates || []);
    const exact = /monthly|quarterly|annual|yearly|semiannual/i.test(frequency);
    return rows.map(row => {
      if (excluded.has(row.date)) return {...row,value:null,reason:`Source quality flag (${row.date}); excluded from heat and baseline`};
      if (row.raw === null) return {...row,value:null,reason:'Missing native value'};
      if (mode === 'level') return {...row,value:row.raw,reason:''};
      const target = shiftYear(row.date,1);
      let base = byDate.get(target);
      if (!base && !exact) {
        let low=0, high=rows.length;
        while (low<high) { const mid=(low+high)>>>1; if (rows[mid].date<=target) low=mid+1; else high=mid; }
        base = rows[low-1];
        if (base && (Date.parse(target)-Date.parse(base.date))/DAY>10) base=undefined;
      }
      if (base && excluded.has(base.date)) return {...row,value:null,reason:`Source quality flag in year-ago base (${base.date})`,baseDate:base.date};
      if (!base || base.raw===null) return {...row,value:null,reason:'Year-ago value unavailable'};
      if (mode==='yoy' && base.raw<=0) return {...row,value:null,reason:'Nonpositive year-ago base'};
      const value = mode==='yoy' ? (row.raw/base.raw-1)*100 : row.raw-base.raw;
      return {...row,value:finite(value)?value:null,reason:finite(value)?'':'Nonfinite transformed value',baseDate:base.date};
    });
  }
  function band(z) { return !finite(z)?'unavailable':Math.abs(z)>=2?'strong':Math.abs(z)>=1?'soft':'neutral'; }
  function analyze(points, options={}) {
    const years = options.years ?? 10, minN = options.minN ?? 12;
    if (!Number.isInteger(years) || years<=0 || !Number.isInteger(minN) || minN<2) throw Error('Invalid baseline settings');
    const rows = transform(points,options.transform || 'level',options.frequency || '',options);
    let left=0,n=0,mean=0,m2=0;
    const valueCounts=new Map();
    // Welford removals can leave roundoff after older variation fully ages out.
    // Exact value identity proves a constant window without an epsilon that
    // would incorrectly suppress a genuinely small nonzero source variance.
    function resetConstant() { if(valueCounts.size===1){mean=valueCounts.keys().next().value;m2=0;} }
    function rebuildMoments() {
      n=0;mean=0;m2=0;
      for(const [value,count] of valueCounts){const total=n+count,delta=value-mean;mean+=delta*count/total;m2+=delta*delta*n*count/total;n=total;}
    }
    function add(x) { valueCounts.set(x,(valueCounts.get(x)||0)+1);n++; const delta=x-mean; mean+=delta/n; m2+=delta*(x-mean);resetConstant(); }
    function remove(x) {
      const count=valueCounts.get(x);if(count===1)valueCounts.delete(x);else valueCounts.set(x,count-1);
      if(n<=1){n=0;mean=0;m2=0;return;}
      const previous=mean,previousM2=m2;n--;mean=previous+(previous-x)/n;m2-=(x-previous)*(x-mean);m2=Math.max(0,m2);resetConstant();
      // Recompute after severe subtractive cancellation. The tolerance only
      // triggers recalculation; it never classifies a small variance as zero.
      if(valueCounts.size>1 && m2<=previousM2*1e-6)rebuildMoments();
    }
    return rows.map((row,i) => {
      const baselineStart=shiftYear(row.date,years);
      while(left<i && rows[left].date<baselineStart) { if(finite(rows[left].value)) remove(rows[left].value);left++; }
      const sd=n>=2?Math.sqrt(Math.max(0,m2)/(n-1)):null;
      let reason=row.reason;
      if (!reason && n<minN) reason=`Insufficient history (${n}/${minN} prior values)`;
      if (!reason && (!finite(sd)||sd===0)) reason='Zero or unavailable baseline SD';
      const z=!reason?(row.value-mean)/sd:null;
      const result={...row,n,mean:n?mean:null,sd,z:finite(z)?z:null,reason,baselineStart,band:band(z)};
      if(finite(row.value)) add(row.value);
      return result;
    });
  }
  return Object.freeze({analyze,transform,band,shiftYear});
});
