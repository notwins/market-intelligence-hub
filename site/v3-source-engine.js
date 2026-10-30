/* UST Decision Lab v1.0.0. Local standalone / host component. See docs/THIRD-PARTY-LICENSES.txt. */
/* Bundled dependency notices:
Pako 1.0.11
Source: https://github.com/nodeca/pako/tree/1.0.11
Unmodified bundled inflate build, used only to read offline XLSX archives.

(The MIT License)

Copyright (C) 2014-2017 by Vitaly Puzrin and Andrei Tuputcyn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.


Content of this folder follows zlib C sources as close as possible.
That's intended to simplify maintainability and guarantee equal API
and result.

Key differences:

- Everything is in JavaScript.
- No platform-dependent blocks.
- Some things like crc32 rewritten to keep size small and make JIT
  work better.
- Some code is different due missed features in JS (macros, pointers,
  structures, header files)
- Specific API methods are not implemented (see notes in root readme)

This port is based on zlib 1.2.8.

This port is under zlib license (see below) with contribution and addition of javascript
port under expat license (see LICENSE at root of project)

Copyright:
(C) 1995-2013 Jean-loup Gailly and Mark Adler
(C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin


From zlib's README
=============================================================================

Acknowledgments:

  The deflate format used by zlib was defined by Phil Katz.  The deflate and
  zlib specifications were written by L.  Peter Deutsch.  Thanks to all the
  people who reported problems and suggested various improvements in zlib; they
  are too numerous to cite here.

Copyright notice:

 (C) 1995-2013 Jean-loup Gailly and Mark Adler

Copyright (c) <''year''> <''copyright holders''>

This software is provided 'as-is', without any express or implied
warranty. In no event will the authors be held liable for any damages
arising from the use of this software.

Permission is granted to anyone to use this software for any purpose,
including commercial applications, and to alter it and redistribute it
freely, subject to the following restrictions:

1. The origin of this software must not be misrepresented; you must not
   claim that you wrote the original software. If you use this software
   in a product, an acknowledgment in the product documentation would be
   appreciated but is not required.
2. Altered source versions must be plainly marked as such, and must not be
   misrepresented as being the original software.
3. This notice may not be removed or altered from any source distribution.


  Jean-loup Gailly        Mark Adler
  jloup@gzip.org          madler@alumni.caltech.edu

*/
(function(){var exports={};var module={exports:exports};
!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{("undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:this).pako=e()}}(function(){return function r(o,s,f){function l(t,e){if(!s[t]){if(!o[t]){var i="function"==typeof require&&require;if(!e&&i)return i(t,!0);if(d)return d(t,!0);var n=new Error("Cannot find module '"+t+"'");throw n.code="MODULE_NOT_FOUND",n}var a=s[t]={exports:{}};o[t][0].call(a.exports,function(e){return l(o[t][1][e]||e)},a,a.exports,r,o,s,f)}return s[t].exports}for(var d="function"==typeof require&&require,e=0;e<f.length;e++)l(f[e]);return l}({1:[function(e,t,i){"use strict";var n="undefined"!=typeof Uint8Array&&"undefined"!=typeof Uint16Array&&"undefined"!=typeof Int32Array;i.assign=function(e){for(var t,i,n=Array.prototype.slice.call(arguments,1);n.length;){var a=n.shift();if(a){if("object"!=typeof a)throw new TypeError(a+"must be non-object");for(var r in a)t=a,i=r,Object.prototype.hasOwnProperty.call(t,i)&&(e[r]=a[r])}}return e},i.shrinkBuf=function(e,t){return e.length===t?e:e.subarray?e.subarray(0,t):(e.length=t,e)};var a={arraySet:function(e,t,i,n,a){if(t.subarray&&e.subarray)e.set(t.subarray(i,i+n),a);else for(var r=0;r<n;r++)e[a+r]=t[i+r]},flattenChunks:function(e){var t,i,n,a,r,o;for(t=n=0,i=e.length;t<i;t++)n+=e[t].length;for(o=new Uint8Array(n),t=a=0,i=e.length;t<i;t++)r=e[t],o.set(r,a),a+=r.length;return o}},r={arraySet:function(e,t,i,n,a){for(var r=0;r<n;r++)e[a+r]=t[i+r]},flattenChunks:function(e){return[].concat.apply([],e)}};i.setTyped=function(e){e?(i.Buf8=Uint8Array,i.Buf16=Uint16Array,i.Buf32=Int32Array,i.assign(i,a)):(i.Buf8=Array,i.Buf16=Array,i.Buf32=Array,i.assign(i,r))},i.setTyped(n)},{}],2:[function(e,t,i){"use strict";var f=e("./common"),a=!0,r=!0;try{String.fromCharCode.apply(null,[0])}catch(e){a=!1}try{String.fromCharCode.apply(null,new Uint8Array(1))}catch(e){r=!1}for(var l=new f.Buf8(256),n=0;n<256;n++)l[n]=252<=n?6:248<=n?5:240<=n?4:224<=n?3:192<=n?2:1;function d(e,t){if(t<65534&&(e.subarray&&r||!e.subarray&&a))return String.fromCharCode.apply(null,f.shrinkBuf(e,t));for(var i="",n=0;n<t;n++)i+=String.fromCharCode(e[n]);return i}l[254]=l[254]=1,i.string2buf=function(e){var t,i,n,a,r,o=e.length,s=0;for(a=0;a<o;a++)55296==(64512&(i=e.charCodeAt(a)))&&a+1<o&&56320==(64512&(n=e.charCodeAt(a+1)))&&(i=65536+(i-55296<<10)+(n-56320),a++),s+=i<128?1:i<2048?2:i<65536?3:4;for(t=new f.Buf8(s),a=r=0;r<s;a++)55296==(64512&(i=e.charCodeAt(a)))&&a+1<o&&56320==(64512&(n=e.charCodeAt(a+1)))&&(i=65536+(i-55296<<10)+(n-56320),a++),i<128?t[r++]=i:(i<2048?t[r++]=192|i>>>6:(i<65536?t[r++]=224|i>>>12:(t[r++]=240|i>>>18,t[r++]=128|i>>>12&63),t[r++]=128|i>>>6&63),t[r++]=128|63&i);return t},i.buf2binstring=function(e){return d(e,e.length)},i.binstring2buf=function(e){for(var t=new f.Buf8(e.length),i=0,n=t.length;i<n;i++)t[i]=e.charCodeAt(i);return t},i.buf2string=function(e,t){var i,n,a,r,o=t||e.length,s=new Array(2*o);for(i=n=0;i<o;)if((a=e[i++])<128)s[n++]=a;else if(4<(r=l[a]))s[n++]=65533,i+=r-1;else{for(a&=2===r?31:3===r?15:7;1<r&&i<o;)a=a<<6|63&e[i++],r--;1<r?s[n++]=65533:a<65536?s[n++]=a:(a-=65536,s[n++]=55296|a>>10&1023,s[n++]=56320|1023&a)}return d(s,n)},i.utf8border=function(e,t){var i;for((t=t||e.length)>e.length&&(t=e.length),i=t-1;0<=i&&128==(192&e[i]);)i--;return i<0?t:0===i?t:i+l[e[i]]>t?i:t}},{"./common":1}],3:[function(e,t,i){"use strict";t.exports=function(e,t,i,n){for(var a=65535&e|0,r=e>>>16&65535|0,o=0;0!==i;){for(i-=o=2e3<i?2e3:i;r=r+(a=a+t[n++]|0)|0,--o;);a%=65521,r%=65521}return a|r<<16|0}},{}],4:[function(e,t,i){"use strict";t.exports={Z_NO_FLUSH:0,Z_PARTIAL_FLUSH:1,Z_SYNC_FLUSH:2,Z_FULL_FLUSH:3,Z_FINISH:4,Z_BLOCK:5,Z_TREES:6,Z_OK:0,Z_STREAM_END:1,Z_NEED_DICT:2,Z_ERRNO:-1,Z_STREAM_ERROR:-2,Z_DATA_ERROR:-3,Z_BUF_ERROR:-5,Z_NO_COMPRESSION:0,Z_BEST_SPEED:1,Z_BEST_COMPRESSION:9,Z_DEFAULT_COMPRESSION:-1,Z_FILTERED:1,Z_HUFFMAN_ONLY:2,Z_RLE:3,Z_FIXED:4,Z_DEFAULT_STRATEGY:0,Z_BINARY:0,Z_TEXT:1,Z_UNKNOWN:2,Z_DEFLATED:8}},{}],5:[function(e,t,i){"use strict";var s=function(){for(var e,t=[],i=0;i<256;i++){e=i;for(var n=0;n<8;n++)e=1&e?3988292384^e>>>1:e>>>1;t[i]=e}return t}();t.exports=function(e,t,i,n){var a=s,r=n+i;e^=-1;for(var o=n;o<r;o++)e=e>>>8^a[255&(e^t[o])];return-1^e}},{}],6:[function(e,t,i){"use strict";t.exports=function(){this.text=0,this.time=0,this.xflags=0,this.os=0,this.extra=null,this.extra_len=0,this.name="",this.comment="",this.hcrc=0,this.done=!1}},{}],7:[function(e,t,i){"use strict";t.exports=function(e,t){var i,n,a,r,o,s,f,l,d,c,u,h,b,m,w,k,_,g,v,p,x,y,S,E,Z;i=e.state,n=e.next_in,E=e.input,a=n+(e.avail_in-5),r=e.next_out,Z=e.output,o=r-(t-e.avail_out),s=r+(e.avail_out-257),f=i.dmax,l=i.wsize,d=i.whave,c=i.wnext,u=i.window,h=i.hold,b=i.bits,m=i.lencode,w=i.distcode,k=(1<<i.lenbits)-1,_=(1<<i.distbits)-1;e:do{b<15&&(h+=E[n++]<<b,b+=8,h+=E[n++]<<b,b+=8),g=m[h&k];t:for(;;){if(h>>>=v=g>>>24,b-=v,0===(v=g>>>16&255))Z[r++]=65535&g;else{if(!(16&v)){if(0==(64&v)){g=m[(65535&g)+(h&(1<<v)-1)];continue t}if(32&v){i.mode=12;break e}e.msg="invalid literal/length code",i.mode=30;break e}p=65535&g,(v&=15)&&(b<v&&(h+=E[n++]<<b,b+=8),p+=h&(1<<v)-1,h>>>=v,b-=v),b<15&&(h+=E[n++]<<b,b+=8,h+=E[n++]<<b,b+=8),g=w[h&_];i:for(;;){if(h>>>=v=g>>>24,b-=v,!(16&(v=g>>>16&255))){if(0==(64&v)){g=w[(65535&g)+(h&(1<<v)-1)];continue i}e.msg="invalid distance code",i.mode=30;break e}if(x=65535&g,b<(v&=15)&&(h+=E[n++]<<b,(b+=8)<v&&(h+=E[n++]<<b,b+=8)),f<(x+=h&(1<<v)-1)){e.msg="invalid distance too far back",i.mode=30;break e}if(h>>>=v,b-=v,(v=r-o)<x){if(d<(v=x-v)&&i.sane){e.msg="invalid distance too far back",i.mode=30;break e}if(S=u,(y=0)===c){if(y+=l-v,v<p){for(p-=v;Z[r++]=u[y++],--v;);y=r-x,S=Z}}else if(c<v){if(y+=l+c-v,(v-=c)<p){for(p-=v;Z[r++]=u[y++],--v;);if(y=0,c<p){for(p-=v=c;Z[r++]=u[y++],--v;);y=r-x,S=Z}}}else if(y+=c-v,v<p){for(p-=v;Z[r++]=u[y++],--v;);y=r-x,S=Z}for(;2<p;)Z[r++]=S[y++],Z[r++]=S[y++],Z[r++]=S[y++],p-=3;p&&(Z[r++]=S[y++],1<p&&(Z[r++]=S[y++]))}else{for(y=r-x;Z[r++]=Z[y++],Z[r++]=Z[y++],Z[r++]=Z[y++],2<(p-=3););p&&(Z[r++]=Z[y++],1<p&&(Z[r++]=Z[y++]))}break}}break}}while(n<a&&r<s);n-=p=b>>3,h&=(1<<(b-=p<<3))-1,e.next_in=n,e.next_out=r,e.avail_in=n<a?a-n+5:5-(n-a),e.avail_out=r<s?s-r+257:257-(r-s),i.hold=h,i.bits=b}},{}],8:[function(e,t,i){"use strict";var z=e("../utils/common"),R=e("./adler32"),N=e("./crc32"),O=e("./inffast"),C=e("./inftrees"),I=1,D=2,T=0,U=-2,F=1,n=852,a=592;function L(e){return(e>>>24&255)+(e>>>8&65280)+((65280&e)<<8)+((255&e)<<24)}function r(){this.mode=0,this.last=!1,this.wrap=0,this.havedict=!1,this.flags=0,this.dmax=0,this.check=0,this.total=0,this.head=null,this.wbits=0,this.wsize=0,this.whave=0,this.wnext=0,this.window=null,this.hold=0,this.bits=0,this.length=0,this.offset=0,this.extra=0,this.lencode=null,this.distcode=null,this.lenbits=0,this.distbits=0,this.ncode=0,this.nlen=0,this.ndist=0,this.have=0,this.next=null,this.lens=new z.Buf16(320),this.work=new z.Buf16(288),this.lendyn=null,this.distdyn=null,this.sane=0,this.back=0,this.was=0}function o(e){var t;return e&&e.state?(t=e.state,e.total_in=e.total_out=t.total=0,e.msg="",t.wrap&&(e.adler=1&t.wrap),t.mode=F,t.last=0,t.havedict=0,t.dmax=32768,t.head=null,t.hold=0,t.bits=0,t.lencode=t.lendyn=new z.Buf32(n),t.distcode=t.distdyn=new z.Buf32(a),t.sane=1,t.back=-1,T):U}function s(e){var t;return e&&e.state?((t=e.state).wsize=0,t.whave=0,t.wnext=0,o(e)):U}function f(e,t){var i,n;return e&&e.state?(n=e.state,t<0?(i=0,t=-t):(i=1+(t>>4),t<48&&(t&=15)),t&&(t<8||15<t)?U:(null!==n.window&&n.wbits!==t&&(n.window=null),n.wrap=i,n.wbits=t,s(e))):U}function l(e,t){var i,n;return e?(n=new r,(e.state=n).window=null,(i=f(e,t))!==T&&(e.state=null),i):U}var d,c,u=!0;function H(e){if(u){var t;for(d=new z.Buf32(512),c=new z.Buf32(32),t=0;t<144;)e.lens[t++]=8;for(;t<256;)e.lens[t++]=9;for(;t<280;)e.lens[t++]=7;for(;t<288;)e.lens[t++]=8;for(C(I,e.lens,0,288,d,0,e.work,{bits:9}),t=0;t<32;)e.lens[t++]=5;C(D,e.lens,0,32,c,0,e.work,{bits:5}),u=!1}e.lencode=d,e.lenbits=9,e.distcode=c,e.distbits=5}function j(e,t,i,n){var a,r=e.state;return null===r.window&&(r.wsize=1<<r.wbits,r.wnext=0,r.whave=0,r.window=new z.Buf8(r.wsize)),n>=r.wsize?(z.arraySet(r.window,t,i-r.wsize,r.wsize,0),r.wnext=0,r.whave=r.wsize):(n<(a=r.wsize-r.wnext)&&(a=n),z.arraySet(r.window,t,i-n,a,r.wnext),(n-=a)?(z.arraySet(r.window,t,i-n,n,0),r.wnext=n,r.whave=r.wsize):(r.wnext+=a,r.wnext===r.wsize&&(r.wnext=0),r.whave<r.wsize&&(r.whave+=a))),0}i.inflateReset=s,i.inflateReset2=f,i.inflateResetKeep=o,i.inflateInit=function(e){return l(e,15)},i.inflateInit2=l,i.inflate=function(e,t){var i,n,a,r,o,s,f,l,d,c,u,h,b,m,w,k,_,g,v,p,x,y,S,E,Z=0,B=new z.Buf8(4),A=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];if(!e||!e.state||!e.output||!e.input&&0!==e.avail_in)return U;12===(i=e.state).mode&&(i.mode=13),o=e.next_out,a=e.output,f=e.avail_out,r=e.next_in,n=e.input,s=e.avail_in,l=i.hold,d=i.bits,c=s,u=f,y=T;e:for(;;)switch(i.mode){case F:if(0===i.wrap){i.mode=13;break}for(;d<16;){if(0===s)break e;s--,l+=n[r++]<<d,d+=8}if(2&i.wrap&&35615===l){B[i.check=0]=255&l,B[1]=l>>>8&255,i.check=N(i.check,B,2,0),d=l=0,i.mode=2;break}if(i.flags=0,i.head&&(i.head.done=!1),!(1&i.wrap)||(((255&l)<<8)+(l>>8))%31){e.msg="incorrect header check",i.mode=30;break}if(8!=(15&l)){e.msg="unknown compression method",i.mode=30;break}if(d-=4,x=8+(15&(l>>>=4)),0===i.wbits)i.wbits=x;else if(x>i.wbits){e.msg="invalid window size",i.mode=30;break}i.dmax=1<<x,e.adler=i.check=1,i.mode=512&l?10:12,d=l=0;break;case 2:for(;d<16;){if(0===s)break e;s--,l+=n[r++]<<d,d+=8}if(i.flags=l,8!=(255&i.flags)){e.msg="unknown compression method",i.mode=30;break}if(57344&i.flags){e.msg="unknown header flags set",i.mode=30;break}i.head&&(i.head.text=l>>8&1),512&i.flags&&(B[0]=255&l,B[1]=l>>>8&255,i.check=N(i.check,B,2,0)),d=l=0,i.mode=3;case 3:for(;d<32;){if(0===s)break e;s--,l+=n[r++]<<d,d+=8}i.head&&(i.head.time=l),512&i.flags&&(B[0]=255&l,B[1]=l>>>8&255,B[2]=l>>>16&255,B[3]=l>>>24&255,i.check=N(i.check,B,4,0)),d=l=0,i.mode=4;case 4:for(;d<16;){if(0===s)break e;s--,l+=n[r++]<<d,d+=8}i.head&&(i.head.xflags=255&l,i.head.os=l>>8),512&i.flags&&(B[0]=255&l,B[1]=l>>>8&255,i.check=N(i.check,B,2,0)),d=l=0,i.mode=5;case 5:if(1024&i.flags){for(;d<16;){if(0===s)break e;s--,l+=n[r++]<<d,d+=8}i.length=l,i.head&&(i.head.extra_len=l),512&i.flags&&(B[0]=255&l,B[1]=l>>>8&255,i.check=N(i.check,B,2,0)),d=l=0}else i.head&&(i.head.extra=null);i.mode=6;case 6:if(1024&i.flags&&(s<(h=i.length)&&(h=s),h&&(i.head&&(x=i.head.extra_len-i.length,i.head.extra||(i.head.extra=new Array(i.head.extra_len)),z.arraySet(i.head.extra,n,r,h,x)),512&i.flags&&(i.check=N(i.check,n,h,r)),s-=h,r+=h,i.length-=h),i.length))break e;i.length=0,i.mode=7;case 7:if(2048&i.flags){if(0===s)break e;for(h=0;x=n[r+h++],i.head&&x&&i.length<65536&&(i.head.name+=String.fromCharCode(x)),x&&h<s;);if(512&i.flags&&(i.check=N(i.check,n,h,r)),s-=h,r+=h,x)break e}else i.head&&(i.head.name=null);i.length=0,i.mode=8;case 8:if(4096&i.flags){if(0===s)break e;for(h=0;x=n[r+h++],i.head&&x&&i.length<65536&&(i.head.comment+=String.fromCharCode(x)),x&&h<s;);if(512&i.flags&&(i.check=N(i.check,n,h,r)),s-=h,r+=h,x)break e}else i.head&&(i.head.comment=null);i.mode=9;case 9:if(512&i.flags){for(;d<16;){if(0===s)break e;s--,l+=n[r++]<<d,d+=8}if(l!==(65535&i.check)){e.msg="header crc mismatch",i.mode=30;break}d=l=0}i.head&&(i.head.hcrc=i.flags>>9&1,i.head.done=!0),e.adler=i.check=0,i.mode=12;break;case 10:for(;d<32;){if(0===s)break e;s--,l+=n[r++]<<d,d+=8}e.adler=i.check=L(l),d=l=0,i.mode=11;case 11:if(0===i.havedict)return e.next_out=o,e.avail_out=f,e.next_in=r,e.avail_in=s,i.hold=l,i.bits=d,2;e.adler=i.check=1,i.mode=12;case 12:if(5===t||6===t)break e;case 13:if(i.last){l>>>=7&d,d-=7&d,i.mode=27;break}for(;d<3;){if(0===s)break e;s--,l+=n[r++]<<d,d+=8}switch(i.last=1&l,d-=1,3&(l>>>=1)){case 0:i.mode=14;break;case 1:if(H(i),i.mode=20,6!==t)break;l>>>=2,d-=2;break e;case 2:i.mode=17;break;case 3:e.msg="invalid block type",i.mode=30}l>>>=2,d-=2;break;case 14:for(l>>>=7&d,d-=7&d;d<32;){if(0===s)break e;s--,l+=n[r++]<<d,d+=8}if((65535&l)!=(l>>>16^65535)){e.msg="invalid stored block lengths",i.mode=30;break}if(i.length=65535&l,d=l=0,i.mode=15,6===t)break e;case 15:i.mode=16;case 16:if(h=i.length){if(s<h&&(h=s),f<h&&(h=f),0===h)break e;z.arraySet(a,n,r,h,o),s-=h,r+=h,f-=h,o+=h,i.length-=h;break}i.mode=12;break;case 17:for(;d<14;){if(0===s)break e;s--,l+=n[r++]<<d,d+=8}if(i.nlen=257+(31&l),l>>>=5,d-=5,i.ndist=1+(31&l),l>>>=5,d-=5,i.ncode=4+(15&l),l>>>=4,d-=4,286<i.nlen||30<i.ndist){e.msg="too many length or distance symbols",i.mode=30;break}i.have=0,i.mode=18;case 18:for(;i.have<i.ncode;){for(;d<3;){if(0===s)break e;s--,l+=n[r++]<<d,d+=8}i.lens[A[i.have++]]=7&l,l>>>=3,d-=3}for(;i.have<19;)i.lens[A[i.have++]]=0;if(i.lencode=i.lendyn,i.lenbits=7,S={bits:i.lenbits},y=C(0,i.lens,0,19,i.lencode,0,i.work,S),i.lenbits=S.bits,y){e.msg="invalid code lengths set",i.mode=30;break}i.have=0,i.mode=19;case 19:for(;i.have<i.nlen+i.ndist;){for(;k=(Z=i.lencode[l&(1<<i.lenbits)-1])>>>16&255,_=65535&Z,!((w=Z>>>24)<=d);){if(0===s)break e;s--,l+=n[r++]<<d,d+=8}if(_<16)l>>>=w,d-=w,i.lens[i.have++]=_;else{if(16===_){for(E=w+2;d<E;){if(0===s)break e;s--,l+=n[r++]<<d,d+=8}if(l>>>=w,d-=w,0===i.have){e.msg="invalid bit length repeat",i.mode=30;break}x=i.lens[i.have-1],h=3+(3&l),l>>>=2,d-=2}else if(17===_){for(E=w+3;d<E;){if(0===s)break e;s--,l+=n[r++]<<d,d+=8}d-=w,x=0,h=3+(7&(l>>>=w)),l>>>=3,d-=3}else{for(E=w+7;d<E;){if(0===s)break e;s--,l+=n[r++]<<d,d+=8}d-=w,x=0,h=11+(127&(l>>>=w)),l>>>=7,d-=7}if(i.have+h>i.nlen+i.ndist){e.msg="invalid bit length repeat",i.mode=30;break}for(;h--;)i.lens[i.have++]=x}}if(30===i.mode)break;if(0===i.lens[256]){e.msg="invalid code -- missing end-of-block",i.mode=30;break}if(i.lenbits=9,S={bits:i.lenbits},y=C(I,i.lens,0,i.nlen,i.lencode,0,i.work,S),i.lenbits=S.bits,y){e.msg="invalid literal/lengths set",i.mode=30;break}if(i.distbits=6,i.distcode=i.distdyn,S={bits:i.distbits},y=C(D,i.lens,i.nlen,i.ndist,i.distcode,0,i.work,S),i.distbits=S.bits,y){e.msg="invalid distances set",i.mode=30;break}if(i.mode=20,6===t)break e;case 20:i.mode=21;case 21:if(6<=s&&258<=f){e.next_out=o,e.avail_out=f,e.next_in=r,e.avail_in=s,i.hold=l,i.bits=d,O(e,u),o=e.next_out,a=e.output,f=e.avail_out,r=e.next_in,n=e.input,s=e.avail_in,l=i.hold,d=i.bits,12===i.mode&&(i.back=-1);break}for(i.back=0;k=(Z=i.lencode[l&(1<<i.lenbits)-1])>>>16&255,_=65535&Z,!((w=Z>>>24)<=d);){if(0===s)break e;s--,l+=n[r++]<<d,d+=8}if(k&&0==(240&k)){for(g=w,v=k,p=_;k=(Z=i.lencode[p+((l&(1<<g+v)-1)>>g)])>>>16&255,_=65535&Z,!(g+(w=Z>>>24)<=d);){if(0===s)break e;s--,l+=n[r++]<<d,d+=8}l>>>=g,d-=g,i.back+=g}if(l>>>=w,d-=w,i.back+=w,i.length=_,0===k){i.mode=26;break}if(32&k){i.back=-1,i.mode=12;break}if(64&k){e.msg="invalid literal/length code",i.mode=30;break}i.extra=15&k,i.mode=22;case 22:if(i.extra){for(E=i.extra;d<E;){if(0===s)break e;s--,l+=n[r++]<<d,d+=8}i.length+=l&(1<<i.extra)-1,l>>>=i.extra,d-=i.extra,i.back+=i.extra}i.was=i.length,i.mode=23;case 23:for(;k=(Z=i.distcode[l&(1<<i.distbits)-1])>>>16&255,_=65535&Z,!((w=Z>>>24)<=d);){if(0===s)break e;s--,l+=n[r++]<<d,d+=8}if(0==(240&k)){for(g=w,v=k,p=_;k=(Z=i.distcode[p+((l&(1<<g+v)-1)>>g)])>>>16&255,_=65535&Z,!(g+(w=Z>>>24)<=d);){if(0===s)break e;s--,l+=n[r++]<<d,d+=8}l>>>=g,d-=g,i.back+=g}if(l>>>=w,d-=w,i.back+=w,64&k){e.msg="invalid distance code",i.mode=30;break}i.offset=_,i.extra=15&k,i.mode=24;case 24:if(i.extra){for(E=i.extra;d<E;){if(0===s)break e;s--,l+=n[r++]<<d,d+=8}i.offset+=l&(1<<i.extra)-1,l>>>=i.extra,d-=i.extra,i.back+=i.extra}if(i.offset>i.dmax){e.msg="invalid distance too far back",i.mode=30;break}i.mode=25;case 25:if(0===f)break e;if(h=u-f,i.offset>h){if((h=i.offset-h)>i.whave&&i.sane){e.msg="invalid distance too far back",i.mode=30;break}h>i.wnext?(h-=i.wnext,b=i.wsize-h):b=i.wnext-h,h>i.length&&(h=i.length),m=i.window}else m=a,b=o-i.offset,h=i.length;for(f<h&&(h=f),f-=h,i.length-=h;a[o++]=m[b++],--h;);0===i.length&&(i.mode=21);break;case 26:if(0===f)break e;a[o++]=i.length,f--,i.mode=21;break;case 27:if(i.wrap){for(;d<32;){if(0===s)break e;s--,l|=n[r++]<<d,d+=8}if(u-=f,e.total_out+=u,i.total+=u,u&&(e.adler=i.check=i.flags?N(i.check,a,u,o-u):R(i.check,a,u,o-u)),u=f,(i.flags?l:L(l))!==i.check){e.msg="incorrect data check",i.mode=30;break}d=l=0}i.mode=28;case 28:if(i.wrap&&i.flags){for(;d<32;){if(0===s)break e;s--,l+=n[r++]<<d,d+=8}if(l!==(4294967295&i.total)){e.msg="incorrect length check",i.mode=30;break}d=l=0}i.mode=29;case 29:y=1;break e;case 30:y=-3;break e;case 31:return-4;case 32:default:return U}return e.next_out=o,e.avail_out=f,e.next_in=r,e.avail_in=s,i.hold=l,i.bits=d,(i.wsize||u!==e.avail_out&&i.mode<30&&(i.mode<27||4!==t))&&j(e,e.output,e.next_out,u-e.avail_out)?(i.mode=31,-4):(c-=e.avail_in,u-=e.avail_out,e.total_in+=c,e.total_out+=u,i.total+=u,i.wrap&&u&&(e.adler=i.check=i.flags?N(i.check,a,u,e.next_out-u):R(i.check,a,u,e.next_out-u)),e.data_type=i.bits+(i.last?64:0)+(12===i.mode?128:0)+(20===i.mode||15===i.mode?256:0),(0===c&&0===u||4===t)&&y===T&&(y=-5),y)},i.inflateEnd=function(e){if(!e||!e.state)return U;var t=e.state;return t.window&&(t.window=null),e.state=null,T},i.inflateGetHeader=function(e,t){var i;return e&&e.state?0==(2&(i=e.state).wrap)?U:((i.head=t).done=!1,T):U},i.inflateSetDictionary=function(e,t){var i,n=t.length;return e&&e.state?0!==(i=e.state).wrap&&11!==i.mode?U:11===i.mode&&R(1,t,n,0)!==i.check?-3:j(e,t,n,n)?(i.mode=31,-4):(i.havedict=1,T):U},i.inflateInfo="pako inflate (from Nodeca project)"},{"../utils/common":1,"./adler32":3,"./crc32":5,"./inffast":7,"./inftrees":9}],9:[function(e,t,i){"use strict";var I=e("../utils/common"),D=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258,0,0],T=[16,16,16,16,16,16,16,16,17,17,17,17,18,18,18,18,19,19,19,19,20,20,20,20,21,21,21,21,16,72,78],U=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577,0,0],F=[16,16,16,16,17,17,18,18,19,19,20,20,21,21,22,22,23,23,24,24,25,25,26,26,27,27,28,28,29,29,64,64];t.exports=function(e,t,i,n,a,r,o,s){var f,l,d,c,u,h,b,m,w,k=s.bits,_=0,g=0,v=0,p=0,x=0,y=0,S=0,E=0,Z=0,B=0,A=null,z=0,R=new I.Buf16(16),N=new I.Buf16(16),O=null,C=0;for(_=0;_<=15;_++)R[_]=0;for(g=0;g<n;g++)R[t[i+g]]++;for(x=k,p=15;1<=p&&0===R[p];p--);if(p<x&&(x=p),0===p)return a[r++]=20971520,a[r++]=20971520,s.bits=1,0;for(v=1;v<p&&0===R[v];v++);for(x<v&&(x=v),_=E=1;_<=15;_++)if(E<<=1,(E-=R[_])<0)return-1;if(0<E&&(0===e||1!==p))return-1;for(N[1]=0,_=1;_<15;_++)N[_+1]=N[_]+R[_];for(g=0;g<n;g++)0!==t[i+g]&&(o[N[t[i+g]]++]=g);if(0===e?(A=O=o,h=19):1===e?(A=D,z-=257,O=T,C-=257,h=256):(A=U,O=F,h=-1),_=v,u=r,S=g=B=0,d=-1,c=(Z=1<<(y=x))-1,1===e&&852<Z||2===e&&592<Z)return 1;for(;;){for(b=_-S,o[g]<h?(m=0,w=o[g]):o[g]>h?(m=O[C+o[g]],w=A[z+o[g]]):(m=96,w=0),f=1<<_-S,v=l=1<<y;a[u+(B>>S)+(l-=f)]=b<<24|m<<16|w|0,0!==l;);for(f=1<<_-1;B&f;)f>>=1;if(0!==f?(B&=f-1,B+=f):B=0,g++,0==--R[_]){if(_===p)break;_=t[i+o[g]]}if(x<_&&(B&c)!==d){for(0===S&&(S=x),u+=v,E=1<<(y=_-S);y+S<p&&!((E-=R[y+S])<=0);)y++,E<<=1;if(Z+=1<<y,1===e&&852<Z||2===e&&592<Z)return 1;a[d=B&c]=x<<24|y<<16|u-r|0}}return 0!==B&&(a[u+B]=_-S<<24|64<<16|0),s.bits=x,0}},{"../utils/common":1}],10:[function(e,t,i){"use strict";t.exports={2:"need dictionary",1:"stream end",0:"","-1":"file error","-2":"stream error","-3":"data error","-4":"insufficient memory","-5":"buffer error","-6":"incompatible version"}},{}],11:[function(e,t,i){"use strict";t.exports=function(){this.input=null,this.next_in=0,this.avail_in=0,this.total_in=0,this.output=null,this.next_out=0,this.avail_out=0,this.total_out=0,this.msg="",this.state=null,this.data_type=2,this.adler=0}},{}],"/lib/inflate.js":[function(e,t,i){"use strict";var c=e("./zlib/inflate"),u=e("./utils/common"),h=e("./utils/strings"),b=e("./zlib/constants"),n=e("./zlib/messages"),a=e("./zlib/zstream"),r=e("./zlib/gzheader"),m=Object.prototype.toString;function o(e){if(!(this instanceof o))return new o(e);this.options=u.assign({chunkSize:16384,windowBits:0,to:""},e||{});var t=this.options;t.raw&&0<=t.windowBits&&t.windowBits<16&&(t.windowBits=-t.windowBits,0===t.windowBits&&(t.windowBits=-15)),!(0<=t.windowBits&&t.windowBits<16)||e&&e.windowBits||(t.windowBits+=32),15<t.windowBits&&t.windowBits<48&&0==(15&t.windowBits)&&(t.windowBits|=15),this.err=0,this.msg="",this.ended=!1,this.chunks=[],this.strm=new a,this.strm.avail_out=0;var i=c.inflateInit2(this.strm,t.windowBits);if(i!==b.Z_OK)throw new Error(n[i]);if(this.header=new r,c.inflateGetHeader(this.strm,this.header),t.dictionary&&("string"==typeof t.dictionary?t.dictionary=h.string2buf(t.dictionary):"[object ArrayBuffer]"===m.call(t.dictionary)&&(t.dictionary=new Uint8Array(t.dictionary)),t.raw&&(i=c.inflateSetDictionary(this.strm,t.dictionary))!==b.Z_OK))throw new Error(n[i])}function s(e,t){var i=new o(t);if(i.push(e,!0),i.err)throw i.msg||n[i.err];return i.result}o.prototype.push=function(e,t){var i,n,a,r,o,s=this.strm,f=this.options.chunkSize,l=this.options.dictionary,d=!1;if(this.ended)return!1;n=t===~~t?t:!0===t?b.Z_FINISH:b.Z_NO_FLUSH,"string"==typeof e?s.input=h.binstring2buf(e):"[object ArrayBuffer]"===m.call(e)?s.input=new Uint8Array(e):s.input=e,s.next_in=0,s.avail_in=s.input.length;do{if(0===s.avail_out&&(s.output=new u.Buf8(f),s.next_out=0,s.avail_out=f),(i=c.inflate(s,b.Z_NO_FLUSH))===b.Z_NEED_DICT&&l&&(i=c.inflateSetDictionary(this.strm,l)),i===b.Z_BUF_ERROR&&!0===d&&(i=b.Z_OK,d=!1),i!==b.Z_STREAM_END&&i!==b.Z_OK)return this.onEnd(i),!(this.ended=!0);s.next_out&&(0!==s.avail_out&&i!==b.Z_STREAM_END&&(0!==s.avail_in||n!==b.Z_FINISH&&n!==b.Z_SYNC_FLUSH)||("string"===this.options.to?(a=h.utf8border(s.output,s.next_out),r=s.next_out-a,o=h.buf2string(s.output,a),s.next_out=r,s.avail_out=f-r,r&&u.arraySet(s.output,s.output,a,r,0),this.onData(o)):this.onData(u.shrinkBuf(s.output,s.next_out)))),0===s.avail_in&&0===s.avail_out&&(d=!0)}while((0<s.avail_in||0===s.avail_out)&&i!==b.Z_STREAM_END);return i===b.Z_STREAM_END&&(n=b.Z_FINISH),n===b.Z_FINISH?(i=c.inflateEnd(this.strm),this.onEnd(i),this.ended=!0,i===b.Z_OK):n!==b.Z_SYNC_FLUSH||(this.onEnd(b.Z_OK),!(s.avail_out=0))},o.prototype.onData=function(e){this.chunks.push(e)},o.prototype.onEnd=function(e){e===b.Z_OK&&("string"===this.options.to?this.result=this.chunks.join(""):this.result=u.flattenChunks(this.chunks)),this.chunks=[],this.err=e,this.msg=this.strm.msg},i.Inflate=o,i.inflate=s,i.inflateRaw=function(e,t){return(t=t||{}).raw=!0,s(e,t)},i.ungzip=s},{"./utils/common":1,"./utils/strings":2,"./zlib/constants":4,"./zlib/gzheader":6,"./zlib/inflate":8,"./zlib/messages":10,"./zlib/zstream":11}]},{},[])("/lib/inflate.js")});

globalThis.USTDecisionInflate=module.exports;
})();
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.USTDecisionEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DAY = 86400000;
  const CURRENCIES = ['SGD', 'USD', 'CHF'];
  const CONVENTION = 'US street; semiannual; Actual/Actual; simple final coupon period';
  const SCHEDULE_WARNING = 'Regular contractual semiannual dates; no holiday adjustment or irregular first coupon is inferred.';
  function number(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v === 'string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(v.trim())) {
      const n = Number(v); return Number.isFinite(n) ? n : null;
    }
    return null;
  }
  function failure(error) { return { ok: false, error }; }
  function failed(errors, warnings) { return { ok: false, errors, warnings: warnings || [] }; }
  function iso(date) { return date.toISOString().slice(0, 10); }
  function date(v) {
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
    const d = new Date(v + 'T00:00:00.000Z');
    return Number.isFinite(d.getTime()) && iso(d) === v ? d : null;
  }
  function days(a, b) { return (b.getTime() - a.getTime()) / DAY; }
  function lastDay(y, m) { const d = new Date(0); d.setUTCFullYear(y, m + 1, 0); d.setUTCHours(0, 0, 0, 0); return d.getUTCDate(); }
  function shiftMonth(anchor, months) {
    const total = anchor.getUTCFullYear() * 12 + anchor.getUTCMonth() + months;
    const y = Math.floor(total / 12), m = total - y * 12;
    const eom = anchor.getUTCDate() === lastDay(anchor.getUTCFullYear(), anchor.getUTCMonth());
    const day = eom ? lastDay(y, m) : Math.min(anchor.getUTCDate(), lastDay(y, m));
    const out = new Date(0); out.setUTCFullYear(y, m, day); out.setUTCHours(0, 0, 0, 0); return out;
  }
  function finiteResults(obj) {
    return Object.keys(obj).every(k => typeof obj[k] !== 'number' || Number.isFinite(obj[k]));
  }
  function validBond(bond, settlement) {
    if (!bond || typeof bond !== 'object') return 'A bond is required.';
    if (bond.currency !== 'USD') return 'This version supports USD nominal Treasury securities only.';
    if (!['coupon', 'strip'].includes(bond.instrumentType)) return 'Unsupported instrument type; TIPS, FRNs and bills require a separate pricing adapter.';
    if (number(bond.frequency) !== 2) return 'A verified semiannual frequency of 2 is required.';
    const c = number(bond.couponPct);
    if (c === null || c < 0) return 'A nonnegative coupon rate is required.';
    if (bond.instrumentType === 'coupon' && c === 0) return 'Use instrumentType strip for a zero-coupon Treasury component.';
    if (bond.instrumentType === 'strip' && c !== 0) return 'A STRIP must have a zero coupon rate.';
    if (bond.irregularCoupons === true || bond.hasIrregularCoupons === true) return 'Irregular coupon schedules require a verified dated-date and payment-schedule adapter.';
    const mat = date(bond.maturity), st = date(settlement);
    if (!mat) return 'Enter a valid contractual maturity date.';
    if (!st) return 'Enter a valid settlement date.';
    if (mat <= st) return 'Settlement must be before maturity.';
    if (days(st, mat) > 366 * 200) return 'Maturity beyond the supported 200-year schedule range.';
    return null;
  }

  function parseQuote(raw, convention) {
    if (!['decimal', 'treasury32'].includes(convention)) return { ok: false, value: null, error: 'Select decimal or Treasury 32nds; price convention is never inferred.' };
    if (raw === null || raw === undefined || typeof raw === 'boolean') return { ok: false, value: null, error: 'A quote is required.' };
    const text = String(raw).trim();
    let value;
    if (convention === 'decimal') {
      const cleaned = /^(?:\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(text) ? text.replace(/,/g, '') : text;
      if (!/^\d+(?:\.\d+)?$/.test(cleaned)) return { ok: false, value: null, error: 'Decimal quotes must contain a positive decimal number.' };
      value = Number(cleaned);
    } else {
      if (/^\d+$/.test(text)) value = Number(text);
      else {
        const m = /^(\d+)([.\-'])(\d{1,3})(\+)?$/.exec(text);
        if (!m) return { ok: false, value: null, error: 'Use points + 32nds, e.g. 95.226, 95-226, or 95-22+.' };
        let f = m[3];
        // Decimal-shaped Excel exports lose trailing zeroes: 58.3 -> 58.30.
        // Non-dot text must retain two 32nds digits to avoid guessing 3 vs 30.
        if (f.length === 1 && m[2] !== '.') return { ok: false, value: null, error: 'Write two 32nds digits, e.g. 95-03 rather than 95-3.' };
        if (f.length === 1) f += '0';
        if (m[4] && f.length !== 2) return { ok: false, value: null, error: 'A plus suffix follows two 32nds digits only.' };
        const ticks = Number(f.slice(0, 2)), eighths = m[4] ? 4 : f.length === 3 ? Number(f[2]) : 0;
        if (ticks > 31 || eighths > 7) return { ok: false, value: null, error: 'Treasury ticks must be 00-31 with an optional eighth digit 0-7.' };
        value = Number(m[1]) + ticks / 32 + eighths / 256;
      }
    }
    if (!(value > 0) || !Number.isFinite(value)) return { ok: false, value: null, error: 'A positive finite price is required.' };
    return { ok: true, value, error: null };
  }

  function schedule(bond, settlement, horizon) {
    const err = validBond(bond, settlement); if (err) return failure(err);
    const st = date(settlement), mat = date(bond.maturity);
    const hd = horizon === null || horizon === undefined ? null : date(horizon);
    if (horizon !== null && horizon !== undefined && (!hd || hd < st)) return failure('Horizon must be a valid date on or after settlement.');
    const all = []; let previous;
    for (let k = 0; k <= 401; k++) {
      const dt = shiftMonth(mat, -6 * k);
      if (dt > st) all.push(dt); else { previous = dt; break; }
    }
    if (!previous || !all.length) return failure('Coupon schedule could not be formed from the supplied terms.');
    all.reverse();
    const next = all[0], periodDays = days(previous, next), elapsedDays = days(previous, st);
    const c = number(bond.couponPct) / 2;
    const accruedPer100 = bond.instrumentType === 'strip' ? 0 : c * elapsedDays / periodDays;
    const payments = (bond.instrumentType === 'strip' ? [mat] : all)
      .filter(dt => !hd || dt <= hd)
      .map(dt => ({ date: iso(dt), couponPer100: bond.instrumentType === 'strip' ? 0 : c, principalPer100: dt.getTime() === mat.getTime() ? 100 : 0 }));
    return { ok: true, error: null, previousCouponDate: iso(previous), nextCouponDate: bond.instrumentType === 'strip' ? null : iso(next),
      accruedPer100, payments, periodDays, elapsedDays, daysToNextCoupon: days(st, next), remainingCouponCount: all.length,
      warnings: [SCHEDULE_WARNING], pricingConvention: CONVENTION };
  }

  function internalPrice(bond, settlement, yieldPct) {
    const s = schedule(bond, settlement); if (!s.ok) return s;
    if (bond.instrumentType === 'strip') return failure('STRIP yield repricing requires a verified STRIP convention adapter. An observed clean price can still be used for initial sizing and FX stress.');
    const yp = number(yieldPct); if (yp === null) return failure('Enter a finite annual yield in percent.');
    const y = yp / 100, q = 1 + y / 2;
    if (!(q > 0)) return failure('The semiannual yield must exceed -200%.');
    const w = s.daysToNextCoupon / s.periodDays, n = s.payments.length;
    let dirty = 0, first = 0, second = 0;
    if (n === 1) {
      const cf = s.payments[0].couponPer100 + s.payments[0].principalPer100;
      const a = w / 2, denominator = 1 + a * y;
      if (!(denominator > 0)) return failure('Yield creates an invalid final-period discount factor.');
      dirty = cf / denominator; first = -cf * a / (denominator * denominator); second = 2 * cf * a * a / Math.pow(denominator, 3);
    } else {
      s.payments.forEach((payment, k) => {
        const exponent = w + k, cf = payment.couponPer100 + payment.principalPer100;
        const pv = cf * Math.pow(q, -exponent);
        dirty += pv; first += -pv * exponent / (2 * q); second += pv * exponent * (exponent + 1) / (4 * q * q);
      });
    }
    const clean = dirty - s.accruedPer100;
    if (!finiteResults({ dirty, clean, first, second }) || !(dirty > 0)) return failure('Yield produces an unsupported non-finite valuation.');
    return { ok: true, error: null, clean, dirty, accruedPer100: s.accruedPer100, first, second, pricingConvention: CONVENTION };
  }
  function priceFromYield(bond, settlement, yieldPct) {
    const result = internalPrice(bond, settlement, yieldPct);
    if (!result.ok) return result;
    const { first, second, ...publicResult } = result; return publicResult;
  }
  function yieldFromPrice(bond, settlement, cleanPrice) {
    const cp = number(cleanPrice); if (cp === null || cp <= 0) return failure('A positive clean price is required for yield calculation.');
    const s = schedule(bond, settlement); if (!s.ok) return s;
    if (bond.instrumentType === 'strip') return failure('STRIP yield calculation requires a verified STRIP convention adapter.');
    const target = cp + s.accruedPer100;
    let low = -199.9, high = 100, lowValue = internalPrice(bond, settlement, low), highValue = internalPrice(bond, settlement, high);
    // Extremely low rates can overflow on long bonds. Move the bracket inward
    // until its price is finite; negative yields remain valid and supported.
    for (let k = 0; !lowValue.ok && k < 40; k++) { low /= 2; lowValue = internalPrice(bond, settlement, low); }
    for (let k = 0; highValue.ok && highValue.dirty > target && k < 40; k++) { high *= 2; highValue = internalPrice(bond, settlement, high); }
    if (!lowValue.ok || !highValue.ok || lowValue.dirty < target || highValue.dirty > target) return failure('Price could not be bracketed within the supported yield domain.');
    let mid = 0, current;
    for (let k = 0; k < 220; k++) {
      mid = (low + high) / 2; current = internalPrice(bond, settlement, mid);
      if (!current.ok) return current;
      if (Math.abs(current.dirty - target) <= 1e-12 * Math.max(1, target) || high - low < 1e-12) break;
      if (current.dirty > target) low = mid; else high = mid;
    }
    return { ok: true, error: null, yieldPct: mid, pricingConvention: CONVENTION, priceResidual: current.dirty - target };
  }
  function risk(bond, settlement, cleanPrice) {
    const yieldResult = yieldFromPrice(bond, settlement, cleanPrice); if (!yieldResult.ok) return yieldResult;
    const p = internalPrice(bond, settlement, yieldResult.yieldPct); if (!p.ok) return p;
    return { ok: true, error: null, yieldPct: yieldResult.yieldPct, modifiedDuration: -p.first / p.dirty, convexity: p.second / p.dirty,
      dv01Per100: -p.first * 0.0001, pricingConvention: CONVENTION, priceResidual: yieldResult.priceResidual };
  }
  function fxRate(currency, reportingCurrency, fx) {
    if (!CURRENCIES.includes(currency) || !CURRENCIES.includes(reportingCurrency)) return null;
    if (currency === reportingCurrency) return 1;
    const f = fx || {};
    function toSgd(c) {
      if (c === 'SGD') return 1;
      const v = number(c === 'USD' ? f.usdSgd : f.chfSgd); return v !== null && v > 0 ? v : null;
    }
    const numerator = toSgd(currency), denominator = toSgd(reportingCurrency);
    return numerator === null || denominator === null ? null : numerator / denominator;
  }

  function buildPosition(bond, context, financing) {
    const ctx = context || {}, loan = financing || {}, errors = [], warnings = [];
    const bondError = validBond(bond, ctx.settlement); if (bondError) errors.push(bondError);
    if (bond && bond.identityVerified !== true) errors.push('Confirm the security identity before sizing a purchase.');
    if (bond && bond.priceVerified !== true) errors.push('Confirm the purchase price and its quotation convention before sizing.');
    const equity = number(ctx.equity), reserve = number(ctx.reserve), fees = number(ctx.fees), lotSize = number(ctx.lotSize);
    if (equity === null || equity <= 0) errors.push('Enter positive own capital.');
    if (!CURRENCIES.includes(ctx.capitalCurrency)) errors.push('Choose the own-capital currency.');
    if (!CURRENCIES.includes(ctx.reportingCurrency)) errors.push('Choose the reporting currency.');
    if (reserve === null || reserve < 0) errors.push('Enter the cash reserve explicitly; enter 0 if none.');
    if (fees === null || fees < 0) errors.push('Enter fees explicitly; enter 0 if none.');
    if (lotSize === null || lotSize <= 0) errors.push('Enter a positive permitted nominal trading increment.');
    const capitalFx = fxRate(ctx.capitalCurrency, ctx.reportingCurrency, ctx.fx);
    const assetFx = fxRate('USD', ctx.reportingCurrency, ctx.fx);
    if (capitalFx === null) errors.push('Enter the FX quote required to translate own capital into the reporting currency.');
    if (assetFx === null) errors.push('Enter the FX quote required to translate USD bonds into the reporting currency.');
    const ask = bond ? number(bond.askClean) : null;
    if (ask === null || ask <= 0) errors.push('A positive verified decimal clean ask price is required.');
    let valuationClean = null;
    if (ctx.valuationBasis === 'ask-clean') valuationClean = ask;
    else if (ctx.valuationBasis === 'bid-clean') valuationClean = bond ? number(bond.bidClean) : null;
    else if (ctx.valuationBasis === 'manual') valuationClean = number(ctx.manualValuationClean);
    else errors.push('Choose the clean valuation basis explicitly.');
    if (valuationClean === null || valuationClean <= 0) errors.push('A positive clean valuation price is required.');
    if (loan.enabled !== true && loan.enabled !== false) errors.push('Choose cash-only or financed mode explicitly.');
    const enabled = loan.enabled === true;
    const loanUnits = enabled ? number(loan.loanAmount) : 0;
    const loanFactor = enabled ? number(loan.loanFactor) : 1;
    const loanRatePct = enabled ? number(loan.loanRatePct) : 0;
    const loanCurrency = enabled ? loan.loanCurrency : ctx.reportingCurrency;
    const loanFx = enabled ? fxRate(loanCurrency, ctx.reportingCurrency, ctx.fx) : 1;
    const loanTenorMonths = enabled ? number(loan.loanTenorMonths) : null;
    const loanDayCount = enabled ? loan.loanDayCount : null;
    if (enabled) {
      if (!CURRENCIES.includes(loanCurrency)) errors.push('Choose the loan currency.');
      if (loanUnits === null || loanUnits < 0) errors.push('Enter a nonnegative actual loan amount in the loan currency.');
      if (loanFactor === null || loanFactor <= 0) errors.push('Enter the positive applicable loan coverage factor.');
      if (loanFx === null) errors.push('Enter the FX quote required to translate the loan.');
      if (loanRatePct === null) warnings.push('Loan rate is missing: net annual cashflow remains unavailable.');
      if (loanTenorMonths === null) warnings.push('Loan tenor is missing: loan repayment and interest dates remain unavailable.');
      else if (!Number.isInteger(loanTenorMonths) || loanTenorMonths <= 0 || loanTenorMonths > 1200) errors.push('Loan tenor must be a positive whole number of months, no more than 1200.');
      if (!['ACT/360', 'ACT/365'].includes(loanDayCount)) warnings.push('Loan day-count basis is missing: dated loan interest remains unavailable.');
    }
    const a = bond ? number(bond.arPct) : null;
    if (a !== null && (a < 0 || a > 100)) errors.push('AR must be between 0% and 100%.');
    const arPct = bond && bond.arVerified === true && a !== null && a >= 0 && a <= 100 ? a : null;
    if (arPct === null) {
      if (enabled) errors.push('Confirm the applicable instrument-level AR before a financed comparison.');
      else warnings.push('AR is unconfirmed: recognised collateral and margin headroom are unavailable.');
    }
    if (errors.length) return failed(errors, warnings);
    const s = schedule(bond, ctx.settlement); if (!s.ok) return failed([s.error], warnings);
    const equityBase = equity * capitalFx, reserveBase = reserve * capitalFx, feesBase = fees * capitalFx;
    const loanBase = loanUnits * loanFx, availableBase = equityBase + loanBase - reserveBase - feesBase;
    if (!(availableBase > 0)) return failed(['Own capital and loan proceeds do not cover the reserve and fees.'], warnings);
    const purchaseDirty = ask + s.accruedPer100, lotCost = lotSize * purchaseDirty / 100 * assetFx;
    if (!(lotCost > 0) || !Number.isFinite(lotCost)) return failed(['Invalid dirty purchase cost or nominal increment.'], warnings);
    const rawLots = availableBase / lotCost, nearest = Math.round(rawLots);
    // Correct only IEEE cancellation at an exact lot boundary, not money rounding.
    const tolerance = 64 * Number.EPSILON * Math.max(1, Math.abs(rawLots));
    const lotCount = Math.abs(rawLots - nearest) < tolerance ? nearest : Math.floor(rawLots);
    const nominal = lotCount * lotSize;
    if (!(nominal > 0)) return failed(['The available budget cannot purchase one permitted nominal increment.'], warnings);
    const purchaseCashBase = nominal * purchaseDirty / 100 * assetFx;
    let residualCashBase = availableBase - purchaseCashBase;
    const cashTolerance = 128 * Number.EPSILON * Math.max(1, availableBase);
    if (Math.abs(residualCashBase) < cashTolerance) residualCashBase = 0;
    if (residualCashBase < 0) return failed(['Purchase exceeds the available budget after the lot-size rule.'], warnings);
    const bondCleanBase = nominal * valuationClean / 100 * assetFx;
    const bondDirtyBase = nominal * (valuationClean + s.accruedPer100) / 100 * assetFx;
    const collateralBase = arPct === null ? null : bondCleanBase * arPct / 100;
    const requiredBase = loanBase * loanFactor;
    const headroomBase = collateralBase === null ? null : collateralBase - requiredBase;
    const navBase = bondDirtyBase + residualCashBase + reserveBase - loanBase;
    const annualCouponUsd = nominal * number(bond.couponPct) / 100, annualCouponBase = annualCouponUsd * assetFx;
    const annualLoanInterestBase = loanRatePct === null ? null : loanBase * loanRatePct / 100;
    const netAnnualCashflowBase = annualLoanInterestBase === null ? null : annualCouponBase - annualLoanInterestBase;
    const metrics = risk(bond, ctx.settlement, valuationClean), purchaseYield = yieldFromPrice(bond, ctx.settlement, ask);
    if (!metrics.ok) warnings.push(metrics.error);
    if (enabled) warnings.push('Annual funding income is a nominal rate-based run rate, not a rollover forecast; dated cashflow uses the entered loan tenor and day-count basis.');
    warnings.push('Collateral uses clean bond value only. Reserve and residual cash are outside collateral but remain in economic NAV. Confirm host policy before live use.');
    warnings.push('Minimum nominal equals the entered trading increment in this template; a separate minimum-size rule belongs in the host adapter.');
    warnings.push(SCHEDULE_WARNING);
    const result = { ok: true, errors: [], warnings, bondId: bond.id, equityBase, capitalCurrency: ctx.capitalCurrency,
      reportingCurrency: ctx.reportingCurrency, assetCurrency: 'USD', loanCurrency, loanUnits, loanBase, loanFactor, loanRatePct,
      nominal, annualCouponUsd, annualCouponBase, annualLoanInterestBase, netAnnualCashflowBase,
      purchaseDirty, purchaseClean: ask, purchaseCashBase, bondCleanBase, bondDirtyBase, collateralBase, requiredBase, headroomBase,
      navBase, residualCashBase, reserveBase, feesBase, retainedCashBase: residualCashBase + reserveBase,
      actualLtvPct: bondCleanBase > 0 ? loanBase / bondCleanBase * 100 : null, actualLtvBasis: 'actual loan / clean bond market value',
      yieldPct: metrics.ok ? metrics.yieldPct : null, purchaseYieldPct: purchaseYield.ok ? purchaseYield.yieldPct : null,
      modifiedDuration: metrics.ok ? metrics.modifiedDuration : null, convexity: metrics.ok ? metrics.convexity : null,
      dv01Base: metrics.ok ? metrics.dv01Per100 * nominal / 100 * assetFx : null, arPct, valuationClean,
      settlement: ctx.settlement, loanTenorMonths, loanDayCount, accruedPer100: s.accruedPer100, nextCouponDate: s.nextCouponDate,
      assetFx, loanFx, capitalFx, financingEnabled: enabled, pricingConvention: CONVENTION,
      annualCashflowBasis: 'Contractual annual coupon minus principal times nominal annual loan rate; no future rollover assumed.' };
    return finiteResults(result) ? result : failed(['One or more amounts exceed the supported numeric range.'], warnings);
  }

  function stressPosition(position, bond, context, shock) {
    if (!position || position.ok !== true) return failed(['A valid base position is required before stress testing.']);
    const sc = shock || {}, errors = [], warnings = ['Instantaneous stress: coupon accrual is unchanged; no time passage, new cashflow or loan-rate reset is modeled.', 'Reserve and residual cash remain constant in the reporting currency.'];
    const ybp = number(sc.yieldBps === undefined ? 0 : sc.yieldBps);
    const afx = number(sc.assetFxPct === undefined ? 0 : sc.assetFxPct);
    const lfx = number(sc.loanFxPct === undefined ? 0 : sc.loanFxPct);
    const arDelta = number(sc.arChangePp === undefined ? 0 : sc.arChangePp);
    if (ybp === null || afx === null || lfx === null || arDelta === null) errors.push('Every shock must be a finite number.');
    if (afx !== null && afx <= -100 || lfx !== null && lfx <= -100) errors.push('FX must remain positive; an FX change must exceed -100%.');
    if (position.assetCurrency === position.reportingCurrency && afx !== 0) errors.push('USD against USD cannot have an FX shock; choose a different reporting currency or set asset FX change to 0.');
    if (position.loanBase !== 0 && position.loanCurrency === position.reportingCurrency && lfx !== 0) errors.push('A loan in the reporting currency cannot have an FX shock.');
    if (position.loanBase !== 0 && position.assetCurrency === position.loanCurrency && afx !== lfx) errors.push('Assets and loan in the same currency must use the same FX change.');
    const ar = position.arPct === null ? null : position.arPct + arDelta;
    if (ar !== null && (ar < 0 || ar > 100)) errors.push('The shocked AR must remain between 0% and 100%; it is not silently capped.');
    if (position.arPct === null && arDelta !== 0) errors.push('A confirmed base AR is required for an AR shock.');
    if (errors.length) return failed(errors, warnings);
    let priceClean = position.valuationClean;
    if (ybp !== 0) {
      if (position.yieldPct === null) return failed(['Yield repricing is unavailable until a supported pricing convention and base yield are available.'], warnings);
      const repriced = priceFromYield(bond, position.settlement, position.yieldPct + ybp / 100);
      if (!repriced.ok) return failed([repriced.error], warnings);
      if (repriced.clean <= 0) return failed(['The shocked clean value is nonpositive and is outside this collateral model.'], warnings);
      priceClean = repriced.clean;
    }
    const assetFx = position.assetFx * (1 + afx / 100);
    const cleanBase = position.nominal * priceClean / 100 * assetFx;
    const assetBase = position.nominal * (priceClean + position.accruedPer100) / 100 * assetFx;
    const loanBase = position.loanBase * (1 + lfx / 100);
    const collateralBase = ar === null ? null : cleanBase * ar / 100;
    const requiredBase = loanBase * position.loanFactor;
    const headroomBase = collateralBase === null ? null : collateralBase - requiredBase;
    const navBase = assetBase + position.residualCashBase + position.reserveBase - loanBase;
    const result = { ok: true, errors: [], warnings, assetBase, cleanBase, loanBase, navBase, collateralBase, requiredBase, headroomBase,
      pnlBase: navBase - position.navBase, priceClean, arPct: ar, yieldPct: position.yieldPct === null ? null : position.yieldPct + ybp / 100 };
    return finiteResults(result) ? result : failed(['Stress amounts exceed the supported numeric range.'], warnings);
  }

  // Decimal rational arithmetic preserves the user's illustrative margin inputs
  // exactly. The optional exact object is text; the numeric fields preserve API
  // compatibility with charts. Finite decimal products never require rounding.
  function gcd(a, b) { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) { const t = b; b = a % b; a = t; } return a || 1n; }
  function rat(n, d) { d = d === undefined ? 1n : d; const g = gcd(n, d); return { n: n / g, d: d / g }; }
  function decRat(v) {
    const s = String(v); if (/e/i.test(s)) return null;
    const neg = s[0] === '-', a = s.replace(/^[+-]/, '').split('.');
    return rat((neg ? -1n : 1n) * BigInt((a[0] || '0') + (a[1] || '')), 10n ** BigInt((a[1] || '').length));
  }
  function radd(a, b) { return rat(a.n * b.d + b.n * a.d, a.d * b.d); }
  function rsub(a, b) { return rat(a.n * b.d - b.n * a.d, a.d * b.d); }
  function rmul(a, b) { return rat(a.n * b.n, a.d * b.d); }
  function rtext(a) {
    const neg = a.n < 0n; let n = neg ? -a.n : a.n, tail = '', rem = n % a.d;
    const whole = String(n / a.d); let count = 0;
    while (rem && count++ < 1500) { rem *= 10n; tail += String(rem / a.d); rem %= a.d; }
    return (neg ? '-' : '') + whole + (tail ? '.' + tail : '');
  }
  function marginCase(input, shock) {
    const i = input || {}, sh = shock || {}, errors = [];
    const av = number(i.assetValue), lv = number(i.loanValue), ar = number(i.arPct), k = number(i.loanFactor);
    const p = number(sh.pricePct === undefined ? 0 : sh.pricePct), u = number(sh.assetFxPct === undefined ? 0 : sh.assetFxPct),
      f = number(sh.loanFxPct === undefined ? 0 : sh.loanFxPct), da = number(sh.arChangePp === undefined ? 0 : sh.arChangePp);
    if (av === null || av < 0 || lv === null || lv < 0) errors.push('Asset and loan values must be explicitly supplied nonnegative amounts.');
    if (ar === null || k === null || k <= 0 || ar < 0 || ar > 100) errors.push('Supply AR between 0% and 100% and a positive loan factor.');
    if ([p, u, f, da].some(v => v === null)) errors.push('Every shock must be a finite number.');
    if (p !== null && p < -100) errors.push('A price loss cannot exceed 100%.');
    if (u !== null && u <= -100 || f !== null && f <= -100) errors.push('FX changes must exceed -100%.');
    if (ar !== null && da !== null && (ar + da < 0 || ar + da > 100)) errors.push('The shocked AR must remain between 0% and 100%.');
    if (errors.length) return failed(errors);
    const inputs = [av, lv, ar, k, p, u, f, da].map(decRat);
    let result;
    if (inputs.every(Boolean)) {
      const [aR, lR, arR, kR, pR, uR, fR, daR] = inputs, one = rat(1n), pct = rat(1n, 100n);
      const asset = rmul(rmul(aR, radd(one, rmul(pR, pct))), radd(one, rmul(uR, pct)));
      const loan = rmul(lR, radd(one, rmul(fR, pct)));
      const recognised = rmul(asset, rmul(radd(arR, daR), pct)), required = rmul(loan, kR);
      const values = { assetValue: asset, loanValue: loan, recognized: recognised, required, headroom: rsub(recognised, required), nav: rsub(asset, loan) };
      const exact = {}; result = { ok: true, errors: [] };
      Object.entries(values).forEach(([key, v]) => { exact[key] = rtext(v); result[key] = Number(exact[key]); });
      result.exact = exact;
    } else {
      const assetValue = av * (1 + p / 100) * (1 + u / 100), loanValue = lv * (1 + f / 100);
      const recognized = assetValue * (ar + da) / 100, required = loanValue * k;
      result = { ok: true, errors: [], assetValue, loanValue, recognized, required, headroom: recognized - required, nav: assetValue - loanValue };
    }
    result.actualLtvPct = result.assetValue > 0 ? result.loanValue / result.assetValue * 100 : null;
    return finiteResults(result) ? result : failed(['Illustration values exceed the supported numeric range.']);
  }

  function cashflow(position, bond, context, horizonDate) {
    if (!position || position.ok !== true) return failed(['A valid base position is required before calculating cashflow.']);
    const hd = date(horizonDate), st = date(position.settlement);
    if (!hd || hd < st) return failed(['Choose a valid horizon on or after settlement.']);
    const s = schedule(bond, position.settlement, horizonDate); if (!s.ok) return failed([s.error]);
    const events = [], warnings = [SCHEDULE_WARNING, 'Future cashflows are translated at the entered FX quotes; no future FX forecast or reinvestment is assumed.'];
    if (position.accruedPer100 > 0) warnings.push('The first full coupon receipt includes interest purchased at settlement. Coupon cash receipts are not the same as earned income over the holding period.');
    let couponTotalBase = 0, bondPrincipalBase = 0, interestTotalBase = 0, loanPrincipalBase = 0,
      accruedLoanInterestBase = 0, complete = true, loanMaturityDate = null;
    s.payments.forEach(payment => {
      if (payment.couponPer100 > 0) {
        const amount = position.nominal * payment.couponPer100 / 100, amountBase = amount * position.assetFx;
        events.push({ date: payment.date, type: 'coupon', currency: 'USD', amount, amountBase }); couponTotalBase += amountBase;
      }
      if (payment.principalPer100 > 0) {
        const amount = position.nominal, amountBase = amount * position.assetFx;
        events.push({ date: payment.date, type: 'bond-principal', currency: 'USD', amount, amountBase }); bondPrincipalBase += amountBase;
      }
    });
    if (position.loanUnits > 0) {
      warnings.push('Simple bullet-loan convention: interest and principal are paid at the first entered tenor end. Confirm the host payment schedule; periodic interest payments are not inferred.');
      const tenor = number(position.loanTenorMonths), rate = number(position.loanRatePct), validBasis = ['ACT/360', 'ACT/365'].includes(position.loanDayCount);
      const hasTenor = tenor !== null && Number.isInteger(tenor) && tenor > 0;
      const hasInterest = rate !== null && validBasis;
      if (!hasTenor) { complete = false; interestTotalBase = null; accruedLoanInterestBase = null; warnings.push('Loan maturity is unknown: enter the first contracted tenor. No rollover is assumed.'); }
      if (!hasInterest) { complete = false; interestTotalBase = null; accruedLoanInterestBase = null; warnings.push('Loan interest is unknown until the rate and ACT/360 or ACT/365 basis are supplied.'); }
      if (hasTenor) {
        const end = shiftMonth(st, tenor); loanMaturityDate = iso(end);
        const denominator = position.loanDayCount === 'ACT/360' ? 360 : 365;
        if (hasInterest) {
          const accrualEnd = hd < end ? hd : end;
          accruedLoanInterestBase = hd < end ? position.loanBase * rate / 100 * days(st, accrualEnd) / denominator : 0;
        }
        if (end <= hd) {
          let interestUnits = null, interestBase = null;
          if (hasInterest) {
            interestUnits = position.loanUnits * rate / 100 * days(st, end) / denominator;
            interestBase = interestUnits * position.loanFx; interestTotalBase = interestBase;
          }
          events.push({ date: iso(end), type: 'loan-interest', currency: position.loanCurrency, amount: interestUnits === null ? null : -interestUnits,
            amountBase: interestBase === null ? null : -interestBase });
          events.push({ date: iso(end), type: 'loan-principal', currency: position.loanCurrency, amount: -position.loanUnits, amountBase: -position.loanBase });
          loanPrincipalBase = position.loanBase;
          if (end < hd) warnings.push('The horizon extends beyond the first loan maturity. Full principal repayment is shown; no renewal or later borrowing is modeled. Continued bond ownership requires funding that repayment.');
        }
      }
    }
    const order = { coupon: 0, 'bond-principal': 1, 'loan-interest': 2, 'loan-principal': 3 };
    events.sort((a, b) => a.date.localeCompare(b.date) || order[a.type] - order[b.type]);
    // An unknown debt schedule must not appear to have a zero funding gap.
    // Known coupons still appear, while aggregate cash sufficiency stays unknown.
    let cash = complete ? position.residualCashBase + position.reserveBase : null, minimum = cash;
    for (const event of events) {
      if (cash !== null && event.amountBase !== null) { cash += event.amountBase; minimum = Math.min(minimum, cash); }
      else cash = null;
      event.cashAfterBase = cash;
    }
    const netCashflowBase = interestTotalBase === null ? null : couponTotalBase - interestTotalBase;
    return { ok: true, errors: [], warnings, complete, events, couponTotalBase, interestTotalBase, netCashflowBase,
      bondPrincipalBase, loanPrincipalBase, netCashMovementBase: netCashflowBase === null ? null : netCashflowBase + bondPrincipalBase - loanPrincipalBase,
      accruedLoanInterestBase, loanMaturityDate, endingCashBase: cash, minimumCashBase: cash === null ? null : minimum,
      externalFundingGapBase: cash === null ? null : Math.max(0, -minimum), horizonDate };
  }
  function capacity(equity, arPct, loanFactor, minHeadroom) {
    const e = number(equity), ar = number(arPct), k = number(loanFactor), h = number(minHeadroom), errors = [];
    if (e === null || e <= 0) errors.push('Own equity must be positive.');
    if (ar === null || ar < 0 || ar > 100) errors.push('AR must be explicitly supplied between 0% and 100%.');
    if (k === null || k <= 0) errors.push('A positive loan factor is required.');
    if (h === null || h < 0) errors.push('Enter a nonnegative minimum headroom.');
    if (errors.length) return failed(errors);
    const a = ar / 100;
    if (k <= a) return failed(['This finite-capacity formula requires the loan factor to exceed the asset recognition factor.']);
    if (a * e < h) return failed(['The target headroom exceeds the recognised unleveraged equity in this simplified model.']);
    const loanMax = (a * e - h) / (k - a), assetsMax = e + loanMax;
    return { ok: true, errors: [], loanMax, assetsMax,
      assumptions: 'One asset; same currency; no fees or reserves; purchase value equals collateral value; no facility or concentration cap.' };
  }
  function cure(deficit, arPct, loanFactor, cashArPct) {
    const d = number(deficit), ar = number(arPct), k = number(loanFactor), ca = number(cashArPct);
    if (d === null || d < 0 || ar === null || ar < 0 || ar > 100 || (ca !== null && (ca < 0 || ca > 100)) || k === null || k <= 0)
      return { ok: false, errors: ['Supply a nonnegative deficit, valid asset/cash ARs and a positive loan factor.'], externalCash: null, externalRepay: null, sellAndRepay: null, pledgedCashRepay: null };
    const a = ar / 100, alpha = ca === null ? null : ca / 100;
    const need = denominator => denominator > 0 ? d / denominator : null;
    return { ok: true, errors: [], warnings: alpha === null ? ['Cash recognition is unknown: cash-pledge and pledged-cash repayment routes remain unavailable.'] : [],
      externalCash: alpha === null ? null : need(alpha), externalRepay: need(k), sellAndRepay: need(k - a), pledgedCashRepay: alpha === null ? null : need(k - alpha),
      assumptions: 'Unchanged price/FX/factors; no costs; sufficient asset and loan balances; external contributions are tracked separately from P&L.' };
  }
  return Object.freeze({ version: '1.0.0', pricingConvention: CONVENTION, parseQuote, schedule, priceFromYield, yieldFromPrice, risk,
    fxRate, buildPosition, stressPosition, marginCase, cashflow, capacity, cure });
});

/* UST Decision Lab - supplied observation data. Source quotes and policies remain unverified. */
(function (g, factory) {
  'use strict';
  const api = factory(g);
  if (typeof module === 'object' && module.exports) module.exports = api;
  g.USTDecisionImport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (g) {
  'use strict';
  const LIMITS = Object.freeze({ file: 20 * 1024 * 1024, expanded: 40 * 1024 * 1024, entry: 16 * 1024 * 1024, rows: 10000, columns: 100, entries: 1000 });
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const clone = value => JSON.parse(JSON.stringify(value));
  const fail = message => ({ ok: false, errors: [String(message)], warnings: [], snapshot: null });
  const text = value => value === null || value === undefined ? '' : String(value).trim();
  const key = value => text(value).toLowerCase().replace(/[^a-z0-9]/g, '');
  const num = value => {
    if (!['string', 'number'].includes(typeof value) || text(value) === '') return null;
    const s = text(value).replace(/%$/, '').trim();
    if (!/^[+-]?(?:\d{1,3}(?:,\d{3})+(?:\.\d*)?|\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(s)) return null;
    const n = Number(s.replace(/,/g, '')); return Number.isFinite(n) ? n : null;
  };
  const iso = value => {
    if (typeof value !== 'string') return null;
    const s = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const d = new Date(s + 'T00:00:00Z'); return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : null;
  };
  const isin = value => {
    const s = text(value).toUpperCase();
    if (!/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(s)) return null;
    const expanded = s.replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55));
    let sum = 0, double = false;
    for (let i = expanded.length - 1; i >= 0; i--) { let d = Number(expanded[i]); if (double) { d *= 2; if (d > 9) d -= 9; } sum += d; double = !double; }
    return sum % 10 === 0 ? s : null;
  };
  const pick = (o, aliases) => { for (const a of aliases) if (own(o, a)) return o[a]; return undefined; };
  function decodeXml(s) {
    return s.replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  }
  function attr(tag, name) { const match = tag.match(new RegExp('(?:^|\\s)' + name.replace(':', '\\:') + '=["\']([^"\']*)["\']')); return match ? decodeXml(match[1]) : null; }
  function excelDate(value, date1904) {
    const n = num(value); if (n === null || n < 0 || n > 100000) return null;
    const offset = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
    return new Date(offset + Math.floor(n) * 86400000).toISOString().slice(0, 10);
  }
  function parseDelimited(content, format) {
    const s = String(content).replace(/^\uFEFF/, '');
    const first = s.split(/\r?\n/).find(line => line.trim()) || '';
    const delimiter = format === 'tsv' || first.includes('\t') ? '\t' : (first.split(';').length > first.split(',').length ? ';' : ',');
    const rows = []; let row = [], cell = '', quoted = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '"') { if (quoted && s[i + 1] === '"') { cell += '"'; i++; } else if (quoted || cell.length === 0) quoted = !quoted; else cell += c; }
      else if (c === delimiter && !quoted) { row.push(cell); cell = ''; }
      else if ((c === '\n' || c === '\r') && !quoted) {
        if (c === '\r' && s[i + 1] === '\n') i++;
        row.push(cell); if (row.some(v => v.trim())) rows.push(row); row = []; cell = '';
      } else cell += c;
      if (row.length > LIMITS.columns || rows.length > LIMITS.rows + 20) throw Error('The import exceeds the supported table size.');
    }
    if (quoted) throw Error('A quoted CSV field was not closed.');
    row.push(cell); if (row.some(v => v.trim())) rows.push(row);
    return rows;
  }
  function normalizeRecord(input, index, options = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Row ' + (index + 1) + ' is not an object.');
    const record = Object.create(null);
    for (const [k, v] of Object.entries(input)) if (!own(record, key(k))) record[key(k)] = v;
    const issues = Array.isArray(input.issues) ? input.issues.filter(x => typeof x === 'string').slice(0, 20) : [];
    const suppliedSourceRow = num(pick(record, ['sourcerow', 'row']));
    const sourceRow = Number.isInteger(suppliedSourceRow) && suppliedSourceRow > 0 ? suppliedSourceRow : index + 2;
    const rawMaturity = pick(record, ['maturity', 'maturitydate', 'parsedmaturity']);
    const maturity = iso(rawMaturity) || (options.excel ? excelDate(rawMaturity, options.date1904) : null);
    const couponPct = num(pick(record, ['couponpct', 'coupons', 'coupon', 'parsedcoupon']));
    if (!maturity) throw Error('Row ' + sourceRow + ': maturity must be a valid ISO date (YYYY-MM-DD).');
    if (couponPct === null || couponPct < 0 || couponPct > 100) throw Error('Row ' + sourceRow + ': coupon percentage is missing or invalid.');
    const currency = text(pick(record, ['currency', 'securitycurrency']) || 'USD').toUpperCase();
    if (currency !== 'USD') throw Error('Row ' + sourceRow + ': v1 imports USD Treasuries only.');
    const originalIsin = text(pick(record, ['isin', 'symbol']));
    const parsedIsin = isin(originalIsin);
    const referenceRows = g.USTDecisionData?.snapshot?.rows || [];
    const refs = referenceRows.filter(b => b.maturity === maturity && b.couponPct === couponPct && b.currency === currency);
    const refIds = [...new Set(refs.map(b => b.isin).filter(Boolean))];
    const knownIdentityRows = parsedIsin ? referenceRows.filter(b => b.isin === parsedIsin) : [];
    const identityConflict = input.identityConflict === true || !options.rawWsj && Boolean(parsedIsin) && (
      (refIds.length > 0 && !refIds.includes(parsedIsin)) ||
      knownIdentityRows.some(b => b.maturity !== maturity || b.couponPct !== couponPct || b.currency !== currency)
    );
    let identity = options.rawWsj || identityConflict ? null : parsedIsin;
    const ignoredRawIsin = originalIsin && (options.rawWsj || !parsedIsin || identityConflict) ? originalIsin : text(input.ignoredRawIsin) || null;
    const identityCandidates = [...new Set([...refIds, ...(Array.isArray(input.identityCandidates) ? input.identityCandidates.map(isin).filter(Boolean) : [])])];
    if (identityConflict) issues.push('Identifier conflicts with supplied coupon/maturity reference terms; identifier and linked AR were quarantined.');
    else if (originalIsin && !identity) issues.push(options.rawWsj ? 'Pasted helper ISIN ignored: validate against coupon and maturity.' : 'Identifier format/check digit needs review.');
    if (!identity && !identityConflict && refIds.length === 1) { identity = refIds[0]; issues.push('Identifier proposed from supplied reference terms; review required.'); }
    let rawBid = text(pick(record, ['rawbid', 'bidraw', 'bid']));
    let rawAsk = text(pick(record, ['rawask', 'askraw', 'ask', 'price']));
    const conventionInput = key(pick(record, ['priceconvention', 'quoteformat']));
    const convention = conventionInput === 'decimal' ? 'decimal' : ['treasury32', '32nds'].includes(conventionInput) ? 'treasury32' : null;
    const rawAr = pick(record, ['arpct', 'fixedar', 'ar', 'moa']);
    const hasExplicitAr = rawAr !== undefined && rawAr !== null && !(typeof rawAr === 'string' && rawAr.trim() === '');
    const parsedAr = num(rawAr);
    const invalidExplicitAr = input.arInputInvalid === true || hasExplicitAr && (parsedAr === null || parsedAr < 0 || parsedAr > 100);
    let arPct = invalidExplicitAr || identityConflict ? null : parsedAr;
    let arCandidates = Array.isArray(input.arCandidates) ? input.arCandidates.map(num).filter(n => n !== null) : [];
    if (!arCandidates.length && !identityConflict && refs.length) {
      arCandidates = [...new Set(refs.flatMap(b => b.arCandidates || (b.arPct === null ? [] : [b.arPct])))];
      if (arCandidates.length) issues.push('Reference AR candidates have no confirmed effective date or facility applicability.');
    }
    if (arPct !== null && !arCandidates.includes(arPct)) arCandidates.push(arPct);
    arCandidates = [...new Set(arCandidates)].filter(n => n >= 0 && n <= 100).sort((a, b) => a - b);
    if (invalidExplicitAr) issues.push('Supplied advance ratio is not a valid scalar percentage from 0 to 100; review required.');
    if (arPct === null && !invalidExplicitAr && !identityConflict && arCandidates.length === 1) arPct = arCandidates[0];
    if (arCandidates.length > 1 && !hasExplicitAr) arPct = null;
    if (arCandidates.length > 1) issues.push('Conflicting AR records; select the applicable policy value.');
    if (arPct === null) issues.push('Applicable AR missing or unresolved.');
    if (arPct === 0) issues.push('Supplied AR is zero: no bond collateral recognition.');
    const reportedYieldPct = num(pick(record, ['reportedyieldpct', 'yieldrawpct', 'suppliedyield', 'yield', 'ytm']));
    if (reportedYieldPct !== null && reportedYieldPct < 0) issues.push('Negative supplied yield; retained for review.');
    const quoteDate = iso(pick(record, ['quotedate', 'pricedate']));
    if (!quoteDate) issues.push('Market quote date is unconfirmed.');
    if (!convention) issues.push('Price notation requires confirmation.');
    const declaredType = key(pick(record, ['instrumenttype', 'type']));
    if (declaredType && !['coupon', 'strip'].includes(declaredType)) throw Error('Row ' + sourceRow + ': only nominal coupon Treasuries and STRIPS are supported.');
    if (declaredType === 'strip' && couponPct !== 0 || declaredType === 'coupon' && couponPct === 0) throw Error('Row ' + sourceRow + ': instrument type conflicts with the coupon; verify the security terms.');
    const instrumentType = declaredType || (couponPct === 0 ? 'strip' : 'coupon');
    const bidClean = num(pick(record, ['bidclean'])); const askClean = num(pick(record, ['askclean']));
    if (bidClean !== null && bidClean <= 0 || askClean !== null && askClean <= 0) throw Error('Row ' + sourceRow + ': clean prices must be positive.');
    if (bidClean !== null && askClean !== null && bidClean > askClean) issues.push('Bid exceeds ask; pricing confirmation is required.');
    if (convention === 'decimal') {
      if (rawBid === '' && bidClean !== null) rawBid = String(bidClean);
      if (rawAsk === '' && askClean !== null) rawAsk = String(askClean);
    }
    const proposedId = refs.length === 1 ? refs[0].id : 'ust-' + maturity + '-' + String(couponPct).replace('.', '_') + '-r' + sourceRow;
    return {
      id: text(pick(record, ['id'])) || proposedId, isin: identity, ignoredRawIsin, identityCandidates, identityConflict,
      name: text(pick(record, ['name', 'securityname'])) || 'UST ' + couponPct + '% ' + maturity,
      currency, instrumentType, maturity, couponPct, frequency: 2,
      rawBid, rawAsk, priceConvention: convention, bidClean, askClean,
      reportedYieldPct, arPct, arCandidates, arInputInvalid: invalidExplicitAr, quoteDate,
      identityVerified: false, priceVerified: false, arVerified: false,
      sourceRow, sourceLabel: text(pick(record, ['sourcelabel'])) || options.label || 'User import',
      issues: [...new Set(issues)], sourceStatus: 'unverified'
    };
  }
  function makeSnapshot(records, options = {}) {
    if (!Array.isArray(records) || !records.length) return fail('No bond rows were found.');
    if (records.length > LIMITS.rows) return fail('Maximum ' + LIMITS.rows + ' rows per import.');
    const rows = [], rejected = [], used = new Set();
    records.forEach((r, i) => { try {
      const b = normalizeRecord(r, i, options);
      if (used.has(b.id)) { rejected.push('Duplicate row ID ' + b.id + ' was held back.'); return; }
      used.add(b.id); rows.push(b);
    } catch (e) { rejected.push(e.message); } });
    if (!rows.length) return { ...fail('No valid Treasury rows remain. ' + rejected.slice(0, 3).join(' ')), warnings: rejected };
    const importedAt = new Date().toISOString();
    const quotes = [...new Set(rows.map(b => b.quoteDate).filter(Boolean))];
    return { ok: true, errors: [], warnings: [
      'Imported records require review before valuation. Verification flags are not trusted from files.',
      ...(options.rawWsj ? ['WSJ helper ISIN, after-spread yield, duration and modeled STRIPS columns were not used.'] : []),
      ...(rejected.length ? [rejected.length + ' rows held back.'] : []), ...rejected.slice(0, 30)
    ], snapshot: { schemaVersion: 1, id: options.id || 'import-' + importedAt, label: options.label || 'Imported Treasury snapshot', importedAt,
      quoteDate: quotes.length === 1 && rows.every(b => b.quoteDate) ? quotes[0] : null, rows,
      audit: { importedRows: rows.length, rejectedRows: rejected.length, rejected, verificationReset: true, rawWsj: Boolean(options.rawWsj) } } };
  }
  function tableToSnapshot(table, options = {}) {
    const h = table.findIndex((r, i) => i < 20 && r.some(v => ['maturity', 'maturitydate', 'parsedmaturity'].includes(key(v))) && r.some(v => ['couponpct', 'coupons', 'coupon', 'parsedcoupon'].includes(key(v))));
    if (h < 0) return fail('No Maturity / Coupon header row found. Use the supplied import example.');
    const header = table[h].map(v => text(v));
    const rawWsj = header.slice(0, 6).map(key).join(',') === 'maturity,coupons,bid,ask,change,yield';
    const hasPrices = header.some(v => ['ask', 'rawask', 'askclean', 'price'].includes(key(v)));
    if (!hasPrices) return fail('This appears to be an AR/security master without prices. Import the daily WSJ price sheet here; merge AR policy through the host adapter after identity and applicability checks.');
    const records = table.slice(h + 1).filter(r => r.some(v => text(v))).map((r, i) => {
      const obj = Object.create(null);
      header.forEach((name, j) => { if (name && !own(obj, name)) obj[name] = r[j] ?? null; });
      obj.sourceRow = Number.isInteger(r.sourceRow) && r.sourceRow > 0 ? r.sourceRow : h + i + 2;
      return obj;
    });
    return makeSnapshot(records, { ...options, rawWsj });
  }
  function parseText(content, format = 'auto') {
    try {
      if (typeof content !== 'string' || !content.trim()) return fail('Paste a CSV, TSV or JSON snapshot first.');
      if (new TextEncoder().encode(content).length > LIMITS.file) return fail('Import limit is 20 MiB.');
      const s = content.trim().replace(/^\uFEFF/, '');
      if (format === 'json' || /^[\[{]/.test(s)) return validateSnapshot(JSON.parse(s));
      return tableToSnapshot(parseDelimited(s, format), { label: 'Pasted Treasury table' });
    } catch (e) { return fail('Import could not be read: ' + e.message); }
  }
  function validateSnapshot(input) {
    try {
      const records = Array.isArray(input) ? input : input?.rows;
      if (!Array.isArray(records)) return fail('Expected a rows array or a JSON array of bond records.');
      if (!Array.isArray(input) && input.schemaVersion !== undefined && input.schemaVersion !== 1) return fail('Only snapshot schemaVersion 1 is supported.');
      return makeSnapshot(records, { label: text(input.label) || 'Imported Treasury snapshot', id: text(input.id) || undefined });
    } catch (e) { return fail(e.message); }
  }
  const CRC = (() => { const a = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; a[n] = c >>> 0; } return a; })();
  function crc32(bytes) { let c = 0xFFFFFFFF; for (const b of bytes) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function unzip(bytes) {
    if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes);
    if (bytes.length > LIMITS.file) throw Error('XLSX exceeds 20 MiB.');
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), decoder = new TextDecoder();
    let end = -1;
    for (let p = bytes.length - 22; p >= Math.max(0, bytes.length - 65557); p--) if (v.getUint32(p, true) === 0x06054b50) { end = p; break; }
    if (end < 0) throw Error('Invalid XLSX archive directory.');
    const count = v.getUint16(end + 10, true), offset = v.getUint32(end + 16, true);
    if (v.getUint16(end + 4, true) || count > LIMITS.entries || count === 0xFFFF || offset === 0xFFFFFFFF) throw Error('Multi-volume, ZIP64 or oversized XLSX archives are unsupported.');
    const entries = new Map(); let cursor = offset, total = 0;
    for (let i = 0; i < count; i++) {
      if (cursor + 46 > bytes.length || v.getUint32(cursor, true) !== 0x02014b50) throw Error('Invalid XLSX directory entry.');
      const flags = v.getUint16(cursor + 8, true), method = v.getUint16(cursor + 10, true), crc = v.getUint32(cursor + 16, true);
      const packed = v.getUint32(cursor + 20, true), size = v.getUint32(cursor + 24, true), nameLen = v.getUint16(cursor + 28, true), extra = v.getUint16(cursor + 30, true), comment = v.getUint16(cursor + 32, true), local = v.getUint32(cursor + 42, true);
      if (flags & 1 || ![0, 8].includes(method) || size > LIMITS.entry || (total += size) > LIMITS.expanded) throw Error('Encrypted, oversized or unsupported XLSX content.');
      const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLen));
      if (name.includes('..') || name.startsWith('/') || entries.has(name)) throw Error('Unsafe or duplicate XLSX entry.');
      if (local + 30 > bytes.length || v.getUint32(local, true) !== 0x04034b50) throw Error('Invalid XLSX local header.');
      const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
      if (start + packed > bytes.length) throw Error('Truncated XLSX data.');
      entries.set(name, { method, crc, packed, size, start }); cursor += 46 + nameLen + extra + comment;
    }
    return { names: [...entries.keys()], read(name) {
      const e = entries.get(name); if (!e) return null;
      const input = bytes.subarray(e.start, e.start + e.packed); let out;
      if (e.method === 0) out = input;
      else {
        if (!g.USTDecisionInflate?.Inflate) throw Error('Offline XLSX decompressor is unavailable; use CSV or TSV.');
        const inflater = new g.USTDecisionInflate.Inflate({ raw: true, chunkSize: 16384 }); const chunks = []; let actual = 0;
        inflater.onData = chunk => { actual += chunk.length; if (actual > e.size || actual > LIMITS.entry) throw Error('XLSX expanded data exceeds its declared limit.'); chunks.push(chunk); };
        inflater.push(input, true); if (inflater.err) throw Error('XLSX compression error: ' + inflater.msg);
        out = new Uint8Array(actual); let at = 0; for (const chunk of chunks) { out.set(chunk, at); at += chunk.length; }
      }
      if (out.length !== e.size || crc32(out) !== e.crc) throw Error('XLSX data integrity check failed.');
      const xml = decoder.decode(out);
      if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw Error('XLSX XML declarations are unsupported.');
      return xml;
    } };
  }
  function xmlTable(xml, shared) {
    const rows = [];
    for (const rm of xml.matchAll(/<(?:\w+:)?row\b([^>]*?)>([\s\S]*?)<\/(?:\w+:)?row>/g)) {
      const row = [];
      const declaredRow = num(attr(rm[1], 'r'));
      let sourceRow = Number.isInteger(declaredRow) && declaredRow > 0 ? declaredRow : null;
      const usedColumns = new Set();
      for (const cm of rm[2].matchAll(/<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g)) {
        const address = attr(cm[1], 'r') || '', letters = (address.match(/^[A-Z]+/) || [''])[0]; let col = 0;
        for (const c of letters) col = col * 26 + c.charCodeAt(0) - 64;
        if (!col || col > LIMITS.columns) continue;
        const addressRow = num(address.slice(letters.length));
        if (Number.isInteger(addressRow) && addressRow > 0) {
          if (sourceRow !== null && addressRow !== sourceRow) throw Error('Worksheet row and cell address disagree.');
          sourceRow = addressRow;
        }
        if (usedColumns.has(col)) throw Error('Worksheet contains a duplicate cell address.');
        usedColumns.add(col);
        const type = attr(cm[1], 't'), inner = cm[2] || '', val = inner.match(/<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/)?.[1];
        let value = val === undefined ? '' : decodeXml(val);
        if (type === 's' && value !== '') {
          if (!/^\d+$/.test(value) || Number(value) >= shared.length) throw Error('Worksheet contains an invalid shared string reference.');
          value = shared[Number(value)];
        }
        else if (type === 'inlineStr') value = [...inner.matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)].map(m => decodeXml(m[1])).join('');
        else if (type === 'b' && value !== '') value = value === '1';
        else if (type !== 'str' && type !== 'e' && type !== 'b' && value !== '' && Number.isFinite(Number(value))) value = Number(value);
        row[col - 1] = value;
      }
      Object.defineProperty(row, 'sourceRow', { value: sourceRow || rows.length + 1 });
      if (row.some(x => text(x))) rows.push(row);
      if (rows.length > LIMITS.rows + 20) throw Error('Worksheet exceeds the row limit.');
    }
    return rows;
  }
  function parseXlsxBytes(bytes, label = 'Imported WSJ workbook') {
    try {
      const archive = unzip(bytes), workbook = archive.read('xl/workbook.xml');
      if (!workbook) return fail('This is not a supported .xlsx workbook.');
      const rels = archive.read('xl/_rels/workbook.xml.rels') || '';
      const relationships = new Map([...rels.matchAll(/<Relationship\b([^>]+)\/?\s*>/g)].map(m => [attr(m[1], 'Id'), attr(m[1], 'Target')]));
      const sheets = [...workbook.matchAll(/<(?:\w+:)?sheet\b([^>]+)\/?\s*>/g)].map(m => ({ name: attr(m[1], 'name'), rid: attr(m[1], 'r:id') }));
      const preferred = sheets.find(s => /^WSJ$/i.test(s.name)) || sheets[0];
      if (!preferred) return fail('Workbook has no worksheets.');
      let target = relationships.get(preferred.rid) || 'worksheets/sheet1.xml';
      target = target.replace(/^\//, ''); if (!target.startsWith('xl/')) target = 'xl/' + target;
      const sheetXml = archive.read(target); if (!sheetXml) return fail('Worksheet could not be found.');
      const sharedXml = archive.read('xl/sharedStrings.xml') || '';
      const shared = [...sharedXml.matchAll(/<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>/g)].map(m => [...m[1].matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)].map(x => decodeXml(x[1])).join(''));
      const date1904 = /\bdate1904=["'](?:1|true)["']/.test(workbook);
      const result = tableToSnapshot(xmlTable(sheetXml, shared), { excel: true, date1904, label: label + ' / ' + preferred.name });
      if (result.ok) result.warnings.push('Only cached worksheet values were read. Formulas were not executed. Quote time and AR applicability require review.');
      return result;
    } catch (e) { return fail('XLSX could not be read: ' + e.message); }
  }
  async function parseFile(file) {
    if (!file || typeof file.arrayBuffer !== 'function') return fail('Choose a local file.');
    if (file.size > LIMITS.file) return fail('Import limit is 20 MiB.');
    if (/\.xlsx$/i.test(file.name)) return parseXlsxBytes(new Uint8Array(await file.arrayBuffer()), file.name);
    if (/\.xls[mba]?$/i.test(file.name)) return fail('Save as standard .xlsx, CSV or TSV; macro/binary/legacy workbooks are not supported.');
    const result = parseText(await file.text(), /\.tsv$/i.test(file.name) ? 'tsv' : /\.json$/i.test(file.name) ? 'json' : 'auto');
    if (result.ok) result.snapshot.label = file.name; return result;
  }
  function exportSelection(bonds, positions, context) {
    if (!Array.isArray(bonds) || !Array.isArray(positions) || bonds.length !== 1 || positions.length !== 1) throw Error('Choose one alternative. Each comparison uses the full equity amount; alternatives must not be combined as one portfolio.');
    const b = bonds[0], p = positions[0];
    const finite = v => typeof v === 'number' && Number.isFinite(v);
    const currencies = ['USD', 'SGD', 'CHF'];
    const scalar = (v, minimum = -Infinity, strict = false) => finite(v) && (strict ? v > minimum : v >= minimum);
    const consistent = (actual, expected) => finite(actual) && finite(expected) && Math.abs(actual - expected) <= 256 * Number.EPSILON * Math.max(1, Math.abs(actual), Math.abs(expected));
    if (!b || !p || !context || p.ok !== true || typeof b.id !== 'string' || !b.id || p.bondId !== b.id) throw Error('The selected structure must pass valuation checks before handoff.');
    if (b.identityVerified !== true || b.priceVerified !== true || !isin(b.isin)) throw Error('Confirm security identity and prices before handoff.');
    if (b.currency !== 'USD' || !['coupon', 'strip'].includes(b.instrumentType) || b.frequency !== 2 ||
      !scalar(b.couponPct, 0) || b.couponPct > 100 || (b.instrumentType === 'strip') !== (b.couponPct === 0) || !iso(b.maturity)) throw Error('Security type, currency, coupon or maturity is inconsistent.');
    if (!iso(b.quoteDate) || !['decimal', 'treasury32'].includes(b.priceConvention) || !scalar(b.askClean, 0, true) ||
      (b.bidClean !== null && b.bidClean !== undefined && (!scalar(b.bidClean, 0, true) || b.bidClean > b.askClean))) throw Error('Verified prices need a valid quote date, explicit convention and positive clean quotes.');
    if (!scalar(context.equity, 0, true) || !scalar(context.reserve, 0) || !scalar(context.fees, 0) || !scalar(context.lotSize, 0, true) ||
      !currencies.includes(context.capitalCurrency) || !currencies.includes(context.reportingCurrency) || !iso(context.settlement) || context.settlement >= b.maturity ||
      !['ask-clean', 'bid-clean', 'manual'].includes(context.valuationBasis)) throw Error('Capital, settlement and valuation context must be complete and numeric before handoff.');
    const positiveFields = ['equityBase', 'nominal', 'purchaseClean', 'purchaseDirty', 'purchaseCashBase', 'bondCleanBase', 'bondDirtyBase', 'valuationClean', 'loanFactor', 'assetFx', 'capitalFx', 'loanFx'];
    const nonnegativeFields = ['loanBase', 'loanUnits', 'reserveBase', 'residualCashBase', 'feesBase', 'requiredBase', 'accruedPer100', 'annualCouponUsd', 'annualCouponBase'];
    if (positiveFields.some(k => !scalar(p[k], 0, true)) || nonnegativeFields.some(k => !scalar(p[k], 0)) || !finite(p.navBase) ||
      p.capitalCurrency !== context.capitalCurrency || p.reportingCurrency !== context.reportingCurrency || p.assetCurrency !== 'USD' ||
      !currencies.includes(p.loanCurrency) || p.settlement !== context.settlement || typeof p.financingEnabled !== 'boolean' ||
      (p.loanBase > 0 && !p.financingEnabled)) throw Error('Position amounts, currencies and financing mode must be complete finite engine outputs.');
    if (p.loanBase > 0 && (b.arVerified !== true || !scalar(b.arPct, 0) || b.arPct > 100 || !finite(p.loanRatePct) ||
      !Number.isInteger(p.loanTenorMonths) || p.loanTenorMonths <= 0 || p.loanTenorMonths > 1200 || !['ACT/360', 'ACT/365'].includes(p.loanDayCount))) throw Error('A financed handoff needs confirmed AR, finite loan rate, whole-month tenor and a supported loan day-count basis.');
    const valuation = context.valuationBasis === 'ask-clean' ? b.askClean : context.valuationBasis === 'bid-clean' ? b.bidClean : context.manualValuationClean;
    if (!scalar(valuation, 0, true) || !consistent(p.valuationClean, valuation) || !consistent(p.purchaseClean, b.askClean) ||
      !consistent(p.purchaseDirty, b.askClean + p.accruedPer100) || !consistent(p.equityBase, context.equity * p.capitalFx) ||
      !consistent(p.reserveBase, context.reserve * p.capitalFx) || !consistent(p.feesBase, context.fees * p.capitalFx) ||
      !consistent(p.loanBase, p.loanUnits * p.loanFx) || !consistent(p.requiredBase, p.loanBase * p.loanFactor) ||
      !consistent(p.purchaseCashBase, p.nominal * p.purchaseDirty / 100 * p.assetFx) ||
      !consistent(p.bondCleanBase, p.nominal * p.valuationClean / 100 * p.assetFx) ||
      !consistent(p.bondDirtyBase, p.nominal * (p.valuationClean + p.accruedPer100) / 100 * p.assetFx) ||
      !consistent(p.purchaseCashBase + p.residualCashBase + p.reserveBase + p.feesBase, p.equityBase + p.loanBase) ||
      !consistent(p.navBase, p.bondDirtyBase + p.residualCashBase + p.reserveBase - p.loanBase)) throw Error('Position amounts do not reconcile with the selected security and capital context; recalculate before handoff.');
    if (p.arPct === null) {
      if (p.loanBase > 0 || p.collateralBase !== null || p.headroomBase !== null) throw Error('Unconfirmed collateral cannot support a financed handoff.');
    } else if (b.arVerified !== true || !scalar(p.arPct, 0) || p.arPct > 100 || p.arPct !== b.arPct ||
      !consistent(p.collateralBase, p.bondCleanBase * p.arPct / 100) || !consistent(p.headroomBase, p.collateralBase - p.requiredBase)) throw Error('Collateral amounts do not reconcile with the confirmed advance ratio.');
    return clone({
      schemaVersion: 1, module: 'ust-decision-lab', moduleVersion: '1.0.0', intent: 'proposed-single-structure',
      createdAt: new Date().toISOString(), comparisonBasis: 'one alternative using the stated own capital',
      capital: { amount: context.equity, currency: context.capitalCurrency, reportingCurrency: context.reportingCurrency },
      context, bond: b, position: p,
      loan: p.loanBase > 0 ? { currency: p.loanCurrency, principal: p.loanUnits, ratePct: p.loanRatePct, coverageFactor: p.loanFactor, tenorMonths: p.loanTenorMonths, dayCount: p.loanDayCount } : null,
      integration: { requiresHostMapping: true, requiresUserReview: true, hostSchema: null, collateralBasis: 'clean price; reserve and residual cash excluded', doNotDoubleSubtractDebt: true, autoRollover: false }
    });
  }
  return Object.freeze({ version: '1.0.0', parseText, parseFile, parseXlsxBytes, validateSnapshot, exportSelection, limits: LIMITS, _test: { parseDelimited, xmlTable, unzip, crc32, isin, num, iso } });
});

globalThis.USTDecisionAssets=Object.freeze({"css":":host{display:block;contain:style;container-type:inline-size;container-name:ust-decision-lab;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif;font-size:14px;line-height:1.5;color:#172e42}\n*{box-sizing:border-box}button,input,select,textarea{font:inherit}button,input,select,textarea,summary{touch-action:manipulation}button{cursor:pointer}button:disabled{cursor:not-allowed;opacity:.5}button:focus-visible,a:focus-visible,summary:focus-visible{outline:3px solid var(--accent);outline-offset:3px}input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid var(--accent);outline-offset:1px}[hidden]{display:none!important}button{padding:9px 13px;border:1px solid var(--line);border-radius:7px;background:var(--surface);color:var(--ink);font-weight:600}button:hover{background:var(--soft)}button svg{width:16px;height:16px;vertical-align:middle}h1,h2,h3,h4,p{margin:0}h1{font-size:28px;line-height:1.2;letter-spacing:-.8px;font-weight:650}h2{font-size:21px;line-height:1.3;letter-spacing:-.25px;font-weight:650}h3{font-size:16px;font-weight:650}h4{font-size:14px}p{color:var(--muted)}small,.micro{font-size:12px;line-height:1.5}.micro{color:var(--muted)}label{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:600;color:var(--ink)}label small{font-weight:400;color:var(--muted);margin-top:-4px}input,select,textarea{color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:10px 11px;min-width:0;width:100%;font-size:14px}input[type=checkbox]{width:17px;height:17px;padding:0;accent-color:var(--accent);flex-shrink:0}input[type=number]{font-variant-numeric:tabular-nums}input::placeholder,textarea::placeholder{color:var(--muted);opacity:.8}select{padding-right:24px}textarea{resize:vertical;min-height:140px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px}.lab-app{--bg:#f7f9fb;--surface:#fff;--ink:#172e42;--muted:#596e80;--line:#dce5ec;--soft:#edf2f6;--accent:#007b78;--accent-text:#006662;--accent-soft:#e5f3ef;--accent-on:#fff;--blue:#345f9e;--bad:#a73b45;--bad-soft:#fbecef;--amber:#845a15;--amber-soft:#fbf2df;--shadow:0 10px 45px #1d354426;background:var(--bg);color:var(--ink);min-width:0;overflow-wrap:anywhere}\n.lab-app[data-theme=dark]{--bg:#111c28;--surface:#172534;--ink:#e2ebf2;--muted:#a8bbca;--line:#314758;--soft:#203344;--accent:#6bd3bf;--accent-text:#9ee7d9;--accent-soft:#173f3d;--accent-on:#102b29;--blue:#9ebeee;--bad:#ffb1bd;--bad-soft:#462c35;--amber:#edca89;--amber-soft:#3b3325;--shadow:0 10px 45px #0006;color-scheme:dark}\n.lab-app[data-accent=navy]{--accent:#285a91;--accent-text:#214b7a;--accent-soft:#e7eef9;--accent-on:#fff}.lab-app[data-accent=navy][data-theme=dark]{--accent:#9bbdf1;--accent-text:#bad3f6;--accent-soft:#203c60;--accent-on:#11263d}\n.lab-header{background:var(--surface);display:flex;justify-content:space-between;gap:24px;padding:26px 30px 23px;align-items:center}.lab-brand{display:flex;gap:15px;align-items:center;min-width:0}.brand-mark{display:grid;place-items:center;background:var(--accent);color:var(--accent-on);font-family:Georgia,serif;font-size:32px;border-radius:10px;width:48px;height:52px;flex-shrink:0}.eyebrow{color:var(--muted);font-size:10px;letter-spacing:1.3px;font-weight:650;display:block;margin-bottom:5px}.lab-brand p{font-size:12px;margin-top:6px}.header-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:end;justify-content:flex-end}.small-control{font-size:10px;gap:3px;color:var(--muted)}.small-control select{font-size:12px;padding:8px 24px 8px 9px}.button-primary{background:var(--accent);border-color:var(--accent);color:var(--accent-on)}.button-primary:hover{filter:brightness(1.06);background:var(--accent)}.button-ghost{background:none;border-color:transparent;color:var(--accent-text)}.icon-button{font-size:12px;font-weight:500}.snapshot-line{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:12px 30px;font-size:12px;color:var(--muted);border-top:1px solid var(--line);background:var(--surface)}.spacer{flex:1}.badge{font-size:10px;font-weight:650;padding:3px 7px;border-radius:4px;display:inline-flex;align-items:center;gap:5px;line-height:1.4;white-space:normal}.badge-amber{color:var(--amber);background:var(--amber-soft)}.badge-good{color:var(--accent-text);background:var(--accent-soft)}.badge-bad{color:var(--bad);background:var(--bad-soft)}.badge-neutral{color:var(--muted);background:var(--soft)}.lab-tabs{display:flex;gap:4px;padding:11px 27px;background:var(--surface);border-bottom:1px solid var(--line);flex-wrap:wrap;position:sticky;top:0;z-index:10}.lab-tabs button{border:0;background:transparent;color:var(--muted);font-weight:600;padding:10px 14px;white-space:nowrap;font-size:13px}.lab-tabs button[aria-selected=true]{color:var(--accent-text);background:var(--accent-soft)}main{padding:0 30px}.view{padding:27px 0 30px}.view-head{display:flex;gap:20px;justify-content:space-between;align-items:flex-start;margin-bottom:24px;flex-wrap:wrap}.view-head p{margin-top:7px;max-width:700px;font-size:13px}.inline-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.inline-actions label{display:flex;flex-direction:row;align-items:center;gap:8px;font-weight:500}.inline-actions select{width:auto}.setup-section{background:var(--surface);border-bottom:1px solid var(--line);margin:0 -30px}.setup-section>summary{padding:15px 30px;display:flex;justify-content:space-between;align-items:center;gap:15px;cursor:pointer;font-size:12px;list-style:none}.setup-section>summary::-webkit-details-marker{display:none}.setup-section>summary:before{content:'+';font-size:19px;color:var(--accent);width:12px;flex-shrink:0}.setup-section[open]>summary:before{content:'−'}.setup-section>summary>span:first-of-type{flex:1}.setup-section>summary .muted{margin-left:9px;font-weight:400}.setup-state{font-size:11px;color:var(--accent-text)}.setup-body{padding:8px 30px 25px}.section-title{display:flex;justify-content:space-between;align-items:baseline;gap:20px;flex-wrap:wrap;margin-bottom:18px}.section-title p{font-size:12px}.field-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:17px 20px}.subsection-head{display:flex;align-items:center;gap:20px;margin:23px 0 15px}.switch-label,.check-label{display:flex;flex-direction:row;gap:8px;align-items:center;font-weight:500}.setup-foot{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:22px}.setup-foot p{flex:1;min-width:200px;max-width:850px}.setup-foot button{font-size:12px}.muted{color:var(--muted)}.numeric{font-variant-numeric:tabular-nums}.count-chip{background:var(--soft);color:var(--muted);padding:3px 7px;border-radius:4px;font-size:11px;font-weight:600}.curve-area{display:grid;grid-template-columns:minmax(0,1fr) 225px;gap:28px;margin:20px 0 25px}.plot{width:100%;min-width:0}.plot svg{display:block;width:100%;max-width:100%;overflow:hidden}.plot svg text{font-family:inherit;font-size:11px;fill:var(--muted)}.plot .grid-line{stroke:var(--line);stroke-width:.7}.plot .axis-frame{stroke:var(--line);fill:none;stroke-width:1}.plot circle{fill:var(--muted);opacity:.3;cursor:pointer}.plot circle.selected{fill:var(--accent);opacity:1;stroke:var(--surface);stroke-width:1.3}.plot circle:hover,.plot circle:focus{opacity:1;stroke:var(--accent);stroke-width:2;outline:none}.plot-detail{min-height:26px;font-size:12px;color:var(--muted);margin:8px 0 0}.curve-aside{background:var(--accent-soft);padding:21px;align-self:start;margin-top:18px}.curve-aside h3{color:var(--accent-text);margin-bottom:15px}.number-callout{font-size:35px;font-variant-numeric:tabular-nums;line-height:1.15;letter-spacing:-1px;margin:6px 0}.curve-aside p{font-size:12px;line-height:1.6}.curve-aside .mini-divider{margin:17px 0;border-top:1px solid color-mix(in srgb,var(--accent) 20%,transparent)}.filter-bar{display:grid;grid-template-columns:minmax(170px,2fr) repeat(3,minmax(100px,1fr));gap:13px;margin:16px 0}.advanced-filter{display:flex;flex-wrap:wrap;gap:15px;align-items:end;padding:15px 0}.advanced-filter label{flex:1;min-width:110px;max-width:190px}.advanced-filter .check-label{min-width:160px;min-height:41px}.filter-details{font-size:12px;color:var(--muted);margin:5px 0 15px}.filter-details summary{cursor:pointer;padding:4px 0}.table-caption{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;padding:12px 0;font-size:12px;color:var(--muted)}.table-wrap{width:100%;overflow-x:auto;background:var(--surface)}table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}th{font-size:11px;color:var(--muted);text-align:left;font-weight:650;white-space:nowrap;background:var(--soft)}th,td{padding:13px 12px;border-bottom:1px solid var(--line);vertical-align:middle}td{font-size:12px}th button{border:0;background:none;padding:0;font:inherit;color:inherit;border-radius:0;white-space:nowrap}th button:hover{background:none;color:var(--accent)}td.num,th.num{text-align:right}td.num{overflow-wrap:anywhere}.master-table{min-width:920px}.master-table td:first-child,.master-table th:first-child{width:44px}.master-table tr.is-selected{background:var(--accent-soft)}.master-table .bond-name{font-size:12px;font-weight:650;text-align:left;display:block;padding:0;border:0;background:none;color:var(--ink);max-width:270px}.master-table .bond-name:hover{color:var(--accent)}.master-table .bond-meta{display:flex;gap:6px;align-items:center;color:var(--muted);font-size:10px;margin-top:6px;flex-wrap:wrap}.watch-button{font-size:21px;line-height:1;padding:3px;background:none;border:0;color:var(--muted);font-weight:400}.watch-button[aria-pressed=true]{color:var(--amber)}.small-text{font-size:10px;color:var(--muted);display:block;margin-top:3px}.group-row td{background:var(--soft);font-weight:650;font-size:11px;padding:11px 12px}.table-actions{display:flex;gap:8px;justify-content:space-between;align-items:center;padding-top:14px;font-size:12px;color:var(--muted);flex-wrap:wrap}.pagination{display:flex;gap:6px;align-items:center}.pagination button{padding:6px 11px;font-size:12px}.empty-state{padding:35px 20px;text-align:center;background:var(--surface);color:var(--muted)}.empty-state h3{color:var(--ink);margin-bottom:8px}.empty-state p{max-width:590px;margin:auto;font-size:13px}.empty-state button{margin-top:16px}.context-band{display:flex;align-items:center;gap:20px;flex-wrap:wrap;background:var(--soft);padding:16px 20px;margin-bottom:22px}.context-band strong{font-size:22px;font-weight:650;font-variant-numeric:tabular-nums}.context-band .spacer{min-width:0}.context-band p{font-size:12px}.context-band .badge{font-size:11px}.comparison-table{min-width:680px;table-layout:fixed}.comparison-table th:first-child{width:190px}.comparison-table th:not(:first-child){white-space:normal;min-width:170px}.comparison-table th .column-name{color:var(--ink);font-size:13px;font-weight:650}.comparison-table th .column-sub{font-size:11px;color:var(--muted);margin-top:5px;font-weight:400}.comparison-table th button{color:var(--accent-text);margin-top:10px;font-size:11px}.comparison-table td:not(:first-child){text-align:right;font-size:12px}.comparison-table td:first-child{color:var(--muted)}.comparison-table .section-row td{background:var(--accent-soft);color:var(--accent-text);font-size:11px;font-weight:700;letter-spacing:.4px;padding:11px 12px;text-align:left}.comparison-table .highlight-row td:not(:first-child){font-size:18px;font-weight:650;color:var(--accent-text)}.comparison-table td.negative{color:var(--bad)}.comparison-table input{width:100%;text-align:right;font-size:12px;padding:9px}.comparison-table .error-list{font-size:11px;text-align:left;color:var(--amber);padding:0;margin:9px 0 0 14px}.comparison-table .error-list li{margin:6px 0}.comparison-table .warn{color:var(--amber)}.comparison-notes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;margin:24px 0}.comparison-notes h3{margin-bottom:9px}.comparison-notes p{font-size:12px;line-height:1.7}.missing-panel{padding:18px 20px;background:var(--amber-soft);color:var(--amber);margin:16px 0}.missing-panel h3{font-size:14px;margin-bottom:8px}.missing-panel p{font-size:12px;color:inherit}.missing-panel ul{margin:10px 0 0;padding-left:18px;font-size:12px}.missing-panel button{margin-top:12px;background:transparent;border-color:color-mix(in srgb,var(--amber) 35%,transparent);color:inherit}.positive{color:var(--accent-text)}.negative{color:var(--bad)}.neutral{color:var(--muted)}.metric-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;padding:19px 0 24px;border-bottom:1px solid var(--line);margin-bottom:25px}.metric-label{font-size:12px;color:var(--muted);display:block}.metric-value{font-size:26px;font-weight:650;line-height:1.3;margin-top:8px;font-variant-numeric:tabular-nums;display:block}.metric-note{font-size:11px;color:var(--muted);margin-top:6px;display:block}.income-controls{display:flex;gap:18px;align-items:end;flex-wrap:wrap;margin-bottom:20px}.income-controls label{min-width:170px;flex:1;max-width:290px}.income-controls button{height:42px}.calendar-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:var(--line);margin:20px 0}.month-cell{background:var(--surface);padding:17px;min-height:145px}.month-cell h4{margin-bottom:14px}.month-event{display:grid;grid-template-columns:28px minmax(0,1fr);gap:8px;font-size:11px;margin:11px 0}.month-day{font-weight:650;color:var(--muted)}.month-event strong{font-variant-numeric:tabular-nums;font-size:12px;display:block}.event-type{color:var(--muted);font-size:10px}.event-table{min-width:580px}.event-table td:last-child{text-align:right}.warning-note{font-size:12px;padding:13px 16px;background:var(--amber-soft);color:var(--amber);margin:14px 0}.notice-band{font-size:12px;background:var(--soft);color:var(--muted);padding:14px 17px;margin:15px 0;line-height:1.6}.notice-band strong{color:var(--ink)}.stress-controls{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:17px;margin:20px 0}.stress-top-controls{display:flex;gap:15px;align-items:end;flex-wrap:wrap}.stress-top-controls label{max-width:320px;min-width:180px;flex:1}.heatmap-settings{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:15px;margin:18px 0}.heatmap-table{table-layout:fixed;min-width:660px}.heatmap-table th{text-align:center;white-space:normal;font-size:11px}.heatmap-table th:first-child{width:95px}.heatmap-table td{padding:3px;border:3px solid var(--surface);text-align:center;vertical-align:middle}.heatmap-table button{width:100%;min-height:68px;padding:8px 5px;border:0;border-radius:0;background:transparent;color:inherit;font-size:11px;font-variant-numeric:tabular-nums;line-height:1.5}.heatmap-table .cell-label{display:block;font-weight:650}.heatmap-table .cell-status{display:block;font-size:9px;margin-top:4px}.heatmap-table .active-cell{outline:2px solid var(--ink);outline-offset:-3px}.heatmap-caption{display:flex;justify-content:space-between;gap:15px;flex-wrap:wrap;font-size:11px;color:var(--muted);margin:10px 0 22px}.lab-app .heat-pos{background:#dcf0e9;color:#134f43}.lab-app .heat-neg{background:#f7dce3;color:#812f3f}.lab-app .heat-zero{background:#edf1f5;color:#384e61}.lab-app[data-theme=dark] .heat-pos{background:#204c42;color:#c4f0e0}.lab-app[data-theme=dark] .heat-neg{background:#5c3041;color:#ffdae4}.lab-app[data-theme=dark] .heat-zero{background:#2b3b4c;color:#d4e2ef}.scenario-details{background:var(--surface);padding:19px 22px;margin:18px 0}.scenario-details h3{margin-bottom:14px}.scenario-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.scenario-grid dt{font-size:11px;color:var(--muted)}.scenario-grid dd{margin:4px 0 0;font-size:17px;font-weight:650;font-variant-numeric:tabular-nums}.example-section{padding-top:29px;margin-top:26px;border-top:1px solid var(--line)}.example-section>p{font-size:12px;margin:8px 0 17px}.example-table{min-width:620px}.example-table td:last-child,.example-table td:nth-last-child(2){font-weight:650}.example-table .key-value{font-size:18px}.example-legend{display:flex;gap:14px;font-size:11px;color:var(--muted);margin:11px 0 0;flex-wrap:wrap}.import-layout{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:28px}.import-panel{background:var(--surface);padding:23px}.import-panel h3{margin-bottom:8px}.import-panel p{font-size:12px;margin-bottom:16px}.import-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:12px}.file-label{display:inline-flex;align-items:center;flex-direction:row;border:1px solid var(--line);border-radius:7px;padding:10px 13px;cursor:pointer;font-size:12px;background:var(--soft)}.file-label input{display:none}.import-preview{margin-top:17px;padding:16px;background:var(--soft);font-size:12px}.import-preview ul{margin:10px 0;padding-left:17px}.import-preview li{margin:5px 0}.audit-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;padding:19px 0}.audit-summary strong{display:block;font-size:27px;line-height:1.2;font-variant-numeric:tabular-nums}.audit-summary span{font-size:11px;color:var(--muted)}.issue-table{min-width:650px}.issue-table td:last-child{max-width:410px}.issue-table button{font-size:11px;padding:6px 8px}.integration-panel{padding:24px 0;margin-top:24px;border-top:1px solid var(--line)}.integration-panel>p{font-size:12px;max-width:850px;margin-top:10px}.code-block{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;white-space:pre-wrap;overflow-wrap:anywhere;background:var(--soft);color:var(--ink);padding:18px;line-height:1.7;margin:15px 0;border-radius:5px}.integration-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}.integration-grid h4{margin-bottom:10px}.integration-grid p{font-size:12px}.compare-tray{display:flex;gap:20px;align-items:center;padding:17px 30px;background:var(--surface);border-top:1px solid var(--line);box-shadow:0 -3px 18px #18334005;flex-wrap:wrap}.compare-tray strong{display:block;font-size:13px;white-space:nowrap}.tray-items{display:flex;gap:8px;flex:1;flex-wrap:wrap}.tray-item{display:flex;gap:9px;align-items:center;padding:7px 10px;background:var(--soft);border-radius:5px;font-size:11px}.tray-item strong{font-size:11px}.tray-item span{display:block;font-size:10px;color:var(--muted)}.tray-item button{border:0;background:none;padding:1px 4px;font-size:19px;font-weight:400;color:var(--muted)}.tray-actions{display:flex;gap:8px}.lab-footer{display:flex;gap:17px;align-items:center;flex-wrap:wrap;justify-content:space-between;padding:18px 30px;font-size:11px;color:var(--muted)}.lab-footer>div{display:flex;align-items:center;gap:15px}.lab-footer label{display:flex;flex-direction:row;align-items:center;font-size:11px;color:var(--muted)}.lab-footer select{font-size:11px;padding:6px 20px 6px 8px;width:auto}.lab-footer button{font-size:11px;padding:6px 10px}.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--ink);color:var(--surface);font-size:12px;padding:13px 19px;border-radius:7px;max-width:min(600px,calc(100vw - 36px));z-index:100;box-shadow:var(--shadow)}.review-dialog{border:0;border-radius:12px;width:min(760px,calc(100% - 32px));max-height:90vh;background:var(--surface);color:var(--ink);padding:0;box-shadow:var(--shadow)}.review-dialog::backdrop{background:#0c203c80}.dialog-header{display:flex;justify-content:space-between;gap:15px;padding:22px 25px;border-bottom:1px solid var(--line)}.dialog-header p{font-size:12px;margin-top:5px}.dialog-header button{border:0;background:var(--soft);font-size:22px;padding:2px 11px;align-self:start}.dialog-body{padding:22px 25px}.dialog-body .field-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.dialog-body .check-label{font-size:12px;line-height:1.6;margin:16px 0}.dialog-preview{display:flex;gap:25px;flex-wrap:wrap;background:var(--soft);padding:13px 16px;margin:14px 0;font-size:12px}.dialog-preview strong{display:block;font-size:16px;font-variant-numeric:tabular-nums}.dialog-footer{padding:16px 25px;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:15px;align-items:center;position:sticky;bottom:0;background:var(--surface)}.dialog-footer p{font-size:11px;max-width:450px}.dialog-error{font-size:12px;color:var(--bad);padding:10px 0}.source-note{font-size:11px;color:var(--muted);margin:10px 0;line-height:1.6}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}.presentation .setup-section,.presentation .filter-bar,.presentation .filter-details,.presentation .compare-tray,.presentation .lab-footer,.presentation .header-actions .small-control{display:none}.presentation .view-head .inline-actions{display:none}.presentation main{padding-top:8px}\n@media(max-width:1100px){.lab-header{align-items:flex-start}.field-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.curve-area{grid-template-columns:minmax(0,1fr) 200px;gap:19px}.header-actions{max-width:380px}.heatmap-settings{grid-template-columns:repeat(2,minmax(0,1fr))}.calendar-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}\n@media(max-width:800px){.lab-header{padding:23px 22px;flex-wrap:wrap}.header-actions{justify-content:flex-start;max-width:none}.snapshot-line{padding:11px 22px}.lab-tabs{padding:10px 17px}.lab-tabs button{font-size:12px;padding:9px 11px}main{padding:0 22px}.setup-section{margin:0 -22px}.setup-section>summary{padding:14px 22px}.setup-body{padding:8px 22px 22px}.setup-section>summary .muted{display:none}.field-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.curve-area{grid-template-columns:minmax(0,1fr)}.curve-aside{display:grid;grid-template-columns:1fr 1fr;gap:12px 20px;margin-top:0;padding:18px}.curve-aside .mini-divider{display:none}.curve-aside .number-callout{font-size:28px}.curve-aside h3{margin-bottom:7px}.filter-bar{grid-template-columns:repeat(2,minmax(0,1fr))}.stress-controls{grid-template-columns:repeat(2,minmax(0,1fr))}.import-layout,.integration-grid{grid-template-columns:minmax(0,1fr)}.compare-tray,.lab-footer{padding:17px 22px}.metric-value{font-size:22px}.scenario-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.comparison-notes{grid-template-columns:1fr}.comparison-table th:first-child{width:160px}.calendar-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}\n@media(max-width:480px){h1{font-size:24px}h2{font-size:19px}.lab-header{padding:20px 16px}.lab-brand{gap:11px}.brand-mark{width:39px;height:44px;font-size:26px}.eyebrow{font-size:9px;letter-spacing:.9px}.header-actions{gap:6px;width:100%}.header-actions button{padding:8px 10px;font-size:11px}.small-control select{font-size:11px}.snapshot-line{padding:11px 16px;gap:8px}.snapshot-line .spacer{display:none}.snapshot-line [data-capital-summary]{width:100%}.lab-tabs{padding:9px 10px;gap:3px;position:static}.lab-tabs button{font-size:11px;padding:9px 8px}main{padding:0 16px}.setup-section{margin:0 -16px}.setup-section>summary{padding:13px 16px;gap:9px;align-items:flex-start}.setup-state{font-size:10px;max-width:100px}.setup-body{padding:8px 16px 19px}.field-grid{grid-template-columns:1fr;gap:14px}.section-title{gap:10px}.setup-foot{align-items:stretch}.setup-foot p{flex-basis:100%}.setup-foot button{flex:1}.view{padding-top:22px}.view-head{gap:12px;margin-bottom:17px}.curve-aside{grid-template-columns:1fr 1fr;padding:16px;gap:12px}.curve-aside h3{font-size:14px}.filter-bar{gap:10px}.advanced-filter label{min-width:110px}.metric-row{grid-template-columns:1fr;gap:18px}.metric-value{font-size:24px;margin-top:4px}.metric-note{margin-top:3px}.context-band{padding:14px;gap:12px}.context-band strong{font-size:19px}.income-controls label{flex-basis:100%;max-width:none}.calendar-grid{grid-template-columns:1fr 1fr}.month-cell{padding:13px;min-height:130px}.month-event{grid-template-columns:22px 1fr;gap:5px}.stress-controls,.heatmap-settings{grid-template-columns:1fr 1fr;gap:12px}.stress-controls label,.heatmap-settings label{font-size:11px}.stress-top-controls label{min-width:150px}.scenario-details{padding:16px}.scenario-grid{gap:14px}.scenario-grid dd{font-size:15px}.import-panel{padding:18px}.audit-summary{gap:10px}.audit-summary strong{font-size:23px}.compare-tray{padding:14px 16px;gap:12px}.tray-items{flex-basis:100%;order:3}.tray-actions{margin-left:auto}.tray-actions button{font-size:12px}.lab-footer{padding:17px 16px;gap:12px}.lab-footer>div{width:100%;justify-content:space-between}.review-dialog{width:calc(100% - 20px);max-height:94vh}.dialog-header{padding:18px}.dialog-body{padding:18px}.dialog-body .field-grid{grid-template-columns:1fr}.dialog-footer{padding:14px 18px;align-items:flex-start}.dialog-footer p{max-width:160px}.dialog-footer button{font-size:12px}.dialog-preview{gap:15px}.toast{font-size:12px}input,select,textarea{font-size:16px}.lab-footer select,.small-control select{font-size:12px}}\n/* Embedded widths follow the component container; viewport rules remain fallbacks. */\n@container ust-decision-lab (max-width:1100px){.lab-header{align-items:flex-start}.field-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.curve-area{grid-template-columns:minmax(0,1fr) 200px;gap:19px}.header-actions{max-width:380px}.heatmap-settings{grid-template-columns:repeat(2,minmax(0,1fr))}.calendar-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}\n@container ust-decision-lab (max-width:800px){.lab-header{padding:23px 22px;flex-wrap:wrap}.header-actions{justify-content:flex-start;max-width:none}.snapshot-line{padding:11px 22px}.lab-tabs{padding:10px 17px}.lab-tabs button{font-size:12px;padding:9px 11px}main{padding:0 22px}.setup-section{margin:0 -22px}.setup-section>summary{padding:14px 22px}.setup-body{padding:8px 22px 22px}.setup-section>summary .muted{display:none}.field-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.curve-area{grid-template-columns:minmax(0,1fr)}.curve-aside{display:grid;grid-template-columns:1fr 1fr;gap:12px 20px;margin-top:0;padding:18px}.curve-aside .mini-divider{display:none}.curve-aside .number-callout{font-size:28px}.curve-aside h3{margin-bottom:7px}.filter-bar{grid-template-columns:repeat(2,minmax(0,1fr))}.stress-controls{grid-template-columns:repeat(2,minmax(0,1fr))}.import-layout,.integration-grid{grid-template-columns:minmax(0,1fr)}.compare-tray,.lab-footer{padding:17px 22px}.metric-value{font-size:22px}.scenario-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.comparison-notes{grid-template-columns:1fr}.comparison-table th:first-child{width:160px}.calendar-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}\n@container ust-decision-lab (max-width:480px){h1{font-size:24px}h2{font-size:19px}.lab-header{padding:20px 16px}.lab-brand{gap:11px}.brand-mark{width:39px;height:44px;font-size:26px}.eyebrow{font-size:9px;letter-spacing:.9px}.header-actions{gap:6px;width:100%}.header-actions button{padding:8px 10px;font-size:11px}.small-control select{font-size:11px}.snapshot-line{padding:11px 16px;gap:8px}.snapshot-line .spacer{display:none}.snapshot-line [data-capital-summary]{width:100%}.lab-tabs{padding:9px 10px;gap:3px;position:static}.lab-tabs button{font-size:11px;padding:9px 8px}main{padding:0 16px}.setup-section{margin:0 -16px}.setup-section>summary{padding:13px 16px;gap:9px;align-items:flex-start}.setup-state{font-size:10px;max-width:100px}.setup-body{padding:8px 16px 19px}.field-grid{grid-template-columns:1fr;gap:14px}.section-title{gap:10px}.setup-foot{align-items:stretch}.setup-foot p{flex-basis:100%}.setup-foot button{flex:1}.view{padding-top:22px}.view-head{gap:12px;margin-bottom:17px}.curve-aside{grid-template-columns:1fr 1fr;padding:16px;gap:12px}.curve-aside h3{font-size:14px}.filter-bar{gap:10px}.advanced-filter label{min-width:110px}.metric-row{grid-template-columns:1fr;gap:18px}.metric-value{font-size:24px;margin-top:4px}.metric-note{margin-top:3px}.context-band{padding:14px;gap:12px}.context-band strong{font-size:19px}.income-controls label{flex-basis:100%;max-width:none}.calendar-grid{grid-template-columns:1fr 1fr}.month-cell{padding:13px;min-height:130px}.month-event{grid-template-columns:22px 1fr;gap:5px}.stress-controls,.heatmap-settings{grid-template-columns:1fr 1fr;gap:12px}.stress-controls label,.heatmap-settings label{font-size:11px}.stress-top-controls label{min-width:150px}.scenario-details{padding:16px}.scenario-grid{gap:14px}.scenario-grid dd{font-size:15px}.import-panel{padding:18px}.audit-summary{gap:10px}.audit-summary strong{font-size:23px}.compare-tray{padding:14px 16px;gap:12px}.tray-items{flex-basis:100%;order:3}.tray-actions{margin-left:auto}.tray-actions button{font-size:12px}.lab-footer{padding:17px 16px;gap:12px}.lab-footer>div{width:100%;justify-content:space-between}.review-dialog{width:calc(100% - 20px);max-height:94vh}.dialog-header{padding:18px}.dialog-body{padding:18px}.dialog-body .field-grid{grid-template-columns:1fr}.dialog-footer{padding:14px 18px;align-items:flex-start}.dialog-footer p{max-width:160px}.dialog-footer button{font-size:12px}.dialog-preview{gap:15px}.toast{font-size:12px}input,select,textarea{font-size:16px}.lab-footer select,.small-control select{font-size:12px}}\n@media(pointer:coarse){button{min-height:42px}.watch-button{min-width:35px}.check-label{min-height:38px}.master-table td:first-child label{min-height:40px}.tray-item button{min-width:30px;min-height:34px}}\n@media print{.lab-app[data-theme][data-accent]{--bg:#fff;--surface:#fff;--ink:#172e42;--muted:#526678;--line:#d5dfe7;--soft:#eef2f6;--accent:#007b78;--accent-text:#006662;--accent-soft:#edf5f2;color:#172e42;background:#fff}.lab-header{padding:12px 0}.header-actions,.lab-tabs,.setup-section,.compare-tray,.lab-footer,.toast,.view-head .inline-actions,.income-controls,.stress-controls,.stress-top-controls,.heatmap-settings,.example-section,.table-actions,.comparison-table input,.comparison-table button,.data-export-actions{display:none!important}.snapshot-line{padding:10px 0}main{padding:0}.view{display:none!important;padding:18px 0}#panel-compare{display:block!important}.table-wrap{overflow:visible}.comparison-table{min-width:0;font-size:9px}.comparison-table th:first-child{width:130px}th,td{padding:8px;font-size:9px!important}.comparison-table th .column-name{font-size:10px}.comparison-table .highlight-row td:not(:first-child){font-size:13px!important}.metric-row{break-inside:avoid}.comparison-notes{break-inside:avoid}.heatmap-table{min-width:0}.heatmap-table button{font-size:8px;min-height:45px}h2{font-size:18px}h3{font-size:13px}tr{break-inside:avoid}.view-head p{font-size:11px}.notice-band{font-size:10px}.print-hide{display:none!important}}\n","html":"<div class=\"lab-app\" data-theme=\"light\" data-accent=\"teal\">\n  <header class=\"lab-header\">\n    <div class=\"lab-brand\"><span class=\"brand-mark\" aria-hidden=\"true\">U</span><div><div class=\"eyebrow\">PORTFOLIO WORKBENCH</div><h1>UST Decision Lab</h1><p>Same capital. Understand the trade-offs.</p></div></div>\n    <div class=\"header-actions\"><label class=\"small-control\">Display precision<select data-pref=\"precision\" aria-label=\"Display precision\"><option value=\"full\">Full precision</option><option value=\"2\">2 decimals</option><option value=\"4\">4 decimals</option></select></label><button class=\"icon-button\" data-action=\"theme\" aria-label=\"Switch appearance\">Dark mode</button><button class=\"icon-button\" data-action=\"focus\" aria-pressed=\"false\">Present</button><button class=\"button-primary\" data-action=\"open-setup\">Set my capital</button></div>\n  </header>\n  <div class=\"snapshot-line\"><span data-snapshot-label></span><span class=\"badge badge-amber\" data-snapshot-status>Imported reference</span><span class=\"spacer\"></span><span data-capital-summary></span></div>\n  <nav class=\"lab-tabs\" role=\"tablist\" aria-label=\"Treasury tools\">\n    <button role=\"tab\" id=\"tab-discover\" aria-controls=\"panel-discover\" aria-selected=\"true\" data-tab=\"discover\">Discover</button>\n    <button role=\"tab\" id=\"tab-compare\" aria-controls=\"panel-compare\" aria-selected=\"false\" data-tab=\"compare\">Compare capital</button>\n    <button role=\"tab\" id=\"tab-income\" aria-controls=\"panel-income\" aria-selected=\"false\" data-tab=\"income\">Income calendar</button>\n    <button role=\"tab\" id=\"tab-stress\" aria-controls=\"panel-stress\" aria-selected=\"false\" data-tab=\"stress\">Risk &amp; margin</button>\n    <button role=\"tab\" id=\"tab-data\" aria-controls=\"panel-data\" aria-selected=\"false\" data-tab=\"data\">Data &amp; integration</button>\n  </nav>\n  <main>\n    <details class=\"setup-section\" data-setup>\n      <summary><span><strong>My comparison settings</strong><span class=\"muted\"> Capital, costs, currency and financing</span></span><span class=\"setup-state\" data-setup-state>Choose your currencies</span></summary>\n      <div class=\"setup-body\">\n        <div class=\"section-title\"><h2>Start with your capital</h2><p>Blank financial inputs remain unknown. Enter 0 explicitly when there is no cost or reserve.</p></div>\n        <div class=\"field-grid\">\n          <label>Own capital<input type=\"number\" min=\"0\" step=\"any\" data-context=\"equity\" value=\"100000\"></label>\n          <label>Capital currency<select data-context=\"capitalCurrency\"><option value=\"\">Choose currency</option><option>SGD</option><option>USD</option><option>CHF</option></select></label>\n          <label>Report results in<select data-context=\"reportingCurrency\"><option value=\"\">Choose currency</option><option>SGD</option><option>USD</option><option>CHF</option></select></label>\n          <label>Settlement date<input type=\"date\" data-context=\"settlement\"></label>\n          <label>SGD per USD<input type=\"number\" min=\"0\" step=\"any\" data-context=\"fx.usdSgd\" placeholder=\"Required for USD / SGD\"></label>\n          <label>SGD per CHF<input type=\"number\" min=\"0\" step=\"any\" data-context=\"fx.chfSgd\" placeholder=\"Required for CHF conversion\"></label>\n          <label>Cash reserve <small>in capital currency</small><input type=\"number\" min=\"0\" step=\"any\" data-context=\"reserve\" placeholder=\"Enter 0 if none\"></label>\n          <label>Purchase fees <small>in capital currency</small><input type=\"number\" min=\"0\" step=\"any\" data-context=\"fees\" placeholder=\"Enter 0 if none\"></label>\n          <label>Nominal increment <small>USD; minimum equals increment</small><input type=\"number\" min=\"0\" step=\"any\" data-context=\"lotSize\" placeholder=\"Confirm trading increment\"></label>\n          <label>Valuation basis<select data-context=\"valuationBasis\"><option value=\"\">Choose basis</option><option value=\"ask-clean\">Purchase ask, indicative</option><option value=\"bid-clean\">Bid price</option><option value=\"manual\">Manual clean price</option></select></label>\n          <label data-manual-price hidden>Manual valuation price<input type=\"number\" min=\"0\" step=\"any\" data-context=\"manualValuationClean\" placeholder=\"Per 100 nominal\"></label>\n        </div>\n        <div class=\"subsection-head\"><h3>Financing</h3><label class=\"switch-label\"><input type=\"checkbox\" data-financing=\"enabled\">Include a loan</label></div>\n        <div class=\"field-grid\" data-loan-fields hidden>\n          <label>Loan currency<select data-financing=\"loanCurrency\"><option value=\"\">Choose currency</option><option>SGD</option><option>CHF</option><option>USD</option></select></label>\n          <label>Default loan amount <small>in loan currency</small><input type=\"number\" min=\"0\" step=\"any\" data-financing=\"loanAmount\" placeholder=\"Can override for each bond\"></label>\n          <label>Loan rate (% p.a.)<input type=\"number\" step=\"any\" data-financing=\"loanRatePct\" placeholder=\"Enter the actual rate\"></label>\n          <label>Collateral coverage factor<input type=\"number\" min=\"0\" step=\"any\" data-financing=\"loanFactor\" value=\"1.07\"><small>1.07 is your supplied example; confirm applicability.</small></label>\n          <label>Loan tenor (months)<input type=\"number\" min=\"1\" step=\"1\" data-financing=\"loanTenorMonths\" placeholder=\"First contractual tenor\"></label>\n          <label>Loan interest basis<select data-financing=\"loanDayCount\"><option value=\"\">Choose day count</option><option value=\"ACT/360\">Actual / 360</option><option value=\"ACT/365\">Actual / 365</option></select></label>\n        </div>\n        <div class=\"setup-foot\"><p class=\"micro\">V1 collateral uses the selected clean bond value. Reserve and residual cash remain in NAV and are excluded from collateral. Confirm the host’s policy before use.</p><button data-action=\"save-case\">Save settings locally</button><button data-action=\"reset-context\">Clear current inputs</button></div>\n      </div>\n    </details>\n    <section id=\"panel-discover\" class=\"view\" role=\"tabpanel\" aria-labelledby=\"tab-discover\"><div data-view-discover></div></section>\n    <section id=\"panel-compare\" class=\"view\" role=\"tabpanel\" aria-labelledby=\"tab-compare\" hidden><div data-view-compare></div></section>\n    <section id=\"panel-income\" class=\"view\" role=\"tabpanel\" aria-labelledby=\"tab-income\" hidden><div data-view-income></div></section>\n    <section id=\"panel-stress\" class=\"view\" role=\"tabpanel\" aria-labelledby=\"tab-stress\" hidden><div data-view-stress></div></section>\n    <section id=\"panel-data\" class=\"view\" role=\"tabpanel\" aria-labelledby=\"tab-data\" hidden><div data-view-data></div></section>\n  </main>\n  <aside class=\"compare-tray\" aria-label=\"Selected bonds\"><div><span class=\"eyebrow\">COMPARISON TRAY</span><strong data-tray-count>0 / 4 bonds</strong></div><div class=\"tray-items\" data-tray-items></div><div class=\"tray-actions\"><button data-action=\"clear-selection\">Clear</button><button class=\"button-primary\" data-action=\"compare-selection\">Compare</button></div></aside>\n  <footer class=\"lab-footer\"><span>UST Decision Lab · v1.0</span><span>Reference data and user-defined scenarios</span><div><label>Accent<select data-pref=\"accent\" aria-label=\"Accent colour\"><option value=\"teal\">Teal</option><option value=\"navy\">Navy</option></select></label><button data-action=\"print\">Print selected review</button></div></footer>\n  <div class=\"toast\" role=\"status\" aria-live=\"polite\" data-toast hidden></div>\n  <dialog class=\"review-dialog\" data-review-dialog aria-labelledby=\"review-title\"><div data-review-content></div></dialog>\n</div>\n"});