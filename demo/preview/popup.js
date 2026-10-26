"use strict";(()=>{var J=new Set(["com.cn","net.cn","org.cn","gov.cn","edu.cn","ac.cn","com.hk","org.hk","net.hk","edu.hk","gov.hk","com.mo","org.mo","net.mo","edu.mo","gov.mo","com.tw","org.tw","net.tw","edu.tw","gov.tw","com.sg","org.sg","net.sg","edu.sg","gov.sg","com.my","org.my","net.my","edu.my","gov.my","co.uk","org.uk","me.uk","ac.uk","gov.uk","ltd.uk","plc.uk","co.jp","or.jp","ne.jp","ac.jp","go.jp","co.kr","or.kr","ne.kr","ac.kr","go.kr","com.au","net.au","org.au","edu.au","gov.au","id.au","co.nz","net.nz","org.nz","govt.nz","ac.nz","com.br","net.br","org.br","gov.br","edu.br","co.in","net.in","org.in","gov.in","ac.in","co.za","org.za","net.za","gov.za","com.mx","com.ar","com.tr","com.ru","com.ua","com.pl","com.es","com.it","co.il","co.id","co.th","co.ve","com.co","com.pe","com.cl","co.at","or.at","gv.at","co.hu","com.pt","com.gr","com.ro","com.vn","com.ph","com.pk","com.bd","com.eg","com.sa","com.ae","github.io","gitlab.io","vercel.app","netlify.app","pages.dev","workers.dev","web.app","firebaseapp.com","appspot.com","blogspot.com","herokuapp.com","azurewebsites.net","cloudfront.net","notion.site","readthedocs.io"]),ee=/^\d{1,3}(\.\d{1,3}){3}$/;function _(e){if(!e)return"";try{return new URL(e).hostname.toLowerCase()}catch{return""}}function te(e){return ee.test(e)||e.includes(":")}function T(e){if(!e)return"";let t=e.toLowerCase().replace(/\.$/,"");if(te(t)||t==="localhost")return t;let o=t.split(".").filter(Boolean);if(o.length<=2)return o.join(".");for(let n=0;n<o.length-1;n+=1){let r=o.slice(n).join(".");if(J.has(r)){let i=Math.max(0,n-1);return o.slice(i).join(".")}}return o.slice(-2).join(".")}var $={upper:"ABCDEFGHJKLMNPQRSTUVWXYZ",lower:"abcdefghijkmnopqrstuvwxyz",digits:"23456789",symbols:"!@#$%^&*()-_=+[]{};:,.?"},I={upper:!0,lower:!0,digits:!0,symbols:!0};function C(e){let t=crypto.getRandomValues(new Uint32Array(1));return e[t[0]%e.length]}function M(e=20,t=I){let o=Object.keys($).filter(i=>t[i]).map(i=>$[i]),n=o.join("");if(!n)return C($.lower).repeat(e);let r=[];for(let i of o)r.push(C(i));for(;r.length<e;)r.push(C(n));for(let i=r.length-1;i>0;i-=1){let s=crypto.getRandomValues(new Uint32Array(1))[0]%(i+1);[r[i],r[s]]=[r[s],r[i]]}return r.slice(0,e).join("")}function N(e){let t=0;return e.length>=12&&(t+=1),e.length>=18&&(t+=1),/[a-z]/.test(e)&&/[A-Z]/.test(e)&&(t+=1),/\d/.test(e)&&(t+=1),/[^A-Za-z0-9]/.test(e)&&(t+=1),Math.min(t,4)}function A(e,t=""){let o=e.trim();if(!o)return t;if(o.includes("@")){let n=o.split("@")[0]?.trim();if(n)return n}if(/^\+?\d[\d\s-]{5,}$/.test(o)){let n=o.replace(/\D/g,"");if(n.length>=4)return`\u5C3E\u53F7${n.slice(-4)}`}return o.length>24?`${o.slice(0,24)}\u2026`:o}function P(e){if(!e)return"\u4ECE\u672A\u4F7F\u7528";let t=Date.now()-e;if(t<6e4)return"\u521A\u521A";let o=Math.floor(t/6e4);if(o<60)return`${o} \u5206\u949F\u524D`;let n=Math.floor(o/60);if(n<24)return`${n} \u5C0F\u65F6\u524D`;let r=Math.floor(n/24);if(r<30)return`${r} \u5929\u524D`;let i=Math.floor(r/30);return i<12?`${i} \u4E2A\u6708\u524D`:`${Math.floor(i/12)} \u5E74\u524D`}function H(e,t,o){let n=(e||t||o).trim();return(Array.from(n)[0]??"?").toUpperCase()}var F=[190,220,250,280];function B(e,t=0){let o=0;for(let n=0;n<e.length;n+=1)o=o*31+e.charCodeAt(n)>>>0;return F[(o+t)%F.length]}function R(){let e=Date.now(),t=864e5;return[{id:"demo-1",domain:"qq.com",host:"mp.weixin.qq.com",scope:"smart",username:"kun_work@163.com",password:"Sk-demo-9f2K!mQ7",label:"\u5BA2\u6237A \xB7 \u516C\u4F17\u53F7",note:"\u54C1\u724C\u4EE3\u8FD0\u8425",createdAt:e-t*46,lastUsedAt:e-36e5,useCount:28},{id:"demo-2",domain:"qq.com",host:"mp.weixin.qq.com",scope:"smart",username:"likun@appin.site",password:"Sk-demo-4hT8#wL2",label:"\u81EA\u5DF1\u53F7 \xB7 \u4E3B\u53F7",note:"\u4E2A\u4EBA\u8BA2\u9605\u53F7",createdAt:e-t*210,lastUsedAt:e-t*3,useCount:9},{id:"demo-3",domain:"qq.com",host:"mp.weixin.qq.com",scope:"smart",username:"wx_abc@qq.com",password:"Sk-demo-7pR3@nV5",label:"\u5BA2\u6237B \xB7 \u670D\u52A1\u53F7",note:"\u6D3B\u52A8\u8FD0\u8425",createdAt:e-t*120,lastUsedAt:e-t*21,useCount:4},{id:"demo-4",domain:"qq.com",host:"mp.weixin.qq.com",scope:"smart",username:"test_01@163.com",password:"Sk-demo-2mX6$kD9",label:"\u54C1\u724C\u4EE3\u8FD0\u8425 \xB7 \u6D4B\u8BD5\u53F7",createdAt:e-t*60,lastUsedAt:e-t*48,useCount:2},{id:"demo-5",domain:"qq.com",host:"mp.weixin.qq.com",scope:"smart",username:"old_2019@163.com",password:"Sk-demo-8qW1!cF4",label:"\u65E7\u53F7 \xB7 \u5DF2\u505C\u7528",createdAt:e-t*800,lastUsedAt:e-t*220,useCount:0}]}function V(){let e=globalThis;if(e.chrome?.runtime?.id)return;let o=new URLSearchParams(location.search).get("state"),n=o==="locked"?"locked":o==="setup"?"uninitialized":"unlocked",r=R(),i={autoLockMinutes:5,autoCapture:!0,showSavePrompt:!0},p="mp.weixin.qq.com",s=(l={})=>({ok:!0,...l});e.chrome={runtime:{id:"mock",async sendMessage(l){switch(l.type){case"STATUS":return s({status:n});case"LIST":return s({host:p,domain:T(p),entries:n==="unlocked"?[...r]:[]});case"FILL":return s();case"SAVE":return r=[{id:`mock-${Date.now()}`,...l.draft,createdAt:Date.now(),lastUsedAt:Date.now(),useCount:1},...r],s({created:!0});case"UPDATE":return r=r.map(g=>g.id===l.entry.id?{...g,...l.entry}:g),s();case"DELETE":return r=r.filter(g=>g.id!==l.id),s();case"LOCK":return n="locked",s();case"UNLOCK":return n="unlocked",s();case"SETUP":return n="unlocked",s();case"GET_SETTINGS":return s({settings:i});case"SET_SETTINGS":return i={...i,...l.settings},s({settings:i});default:return s()}},openOptionsPage(){window.open("options.html","_blank","noopener")},getURL(l){return l}},tabs:{async query(){return[{id:1,url:`https://${p}/cgi-bin/loginpage`}]}}}}var oe=typeof chrome<"u"&&!!chrome.runtime?.id;oe||(V(),document.body.classList.add("preview"));var D=document.getElementById("screen"),v=document.getElementById("backdrop"),f=document.getElementById("sheet"),w=document.getElementById("snack"),a={status:"locked",url:"",host:"",domain:"",entries:[],query:""},ne={BAD_PASSWORD:"\u4E3B\u5BC6\u7801\u4E0D\u6B63\u786E",WEAK_PASSWORD:"\u4E3B\u5BC6\u7801\u81F3\u5C11 8 \u4F4D",ALREADY_INITIALIZED:"\u4FDD\u9669\u5E93\u5DF2\u7ECF\u521D\u59CB\u5316",NOT_INITIALIZED:"\u8FD8\u6CA1\u6709\u521B\u5EFA\u4FDD\u9669\u5E93",LOCKED:"\u4FDD\u9669\u5E93\u5DF2\u9501\u5B9A\uFF0C\u8BF7\u91CD\u65B0\u89E3\u9501",NOT_FOUND:"\u627E\u4E0D\u5230\u8FD9\u6761\u8BB0\u5F55",NO_CONTENT_SCRIPT:"\u8FD9\u4E2A\u9875\u9762\u4E0D\u5141\u8BB8\u6269\u5C55\u5199\u5165\uFF0C\u53EF\u4EE5\u70B9 \u22EF \u590D\u5236\u5BC6\u7801",NO_PASSWORD_FIELD:"\u8FD9\u4E00\u9875\u6CA1\u627E\u5230\u767B\u5F55\u8F93\u5165\u6846\uFF0C\u53EF\u4EE5\u70B9 \u22EF \u590D\u5236\u5BC6\u7801",NO_TAB:"\u627E\u4E0D\u5230\u5F53\u524D\u6807\u7B7E\u9875",BAD_BACKUP:"\u5907\u4EFD\u6587\u4EF6\u65E0\u6548",CSV_MISSING_COLUMNS:"CSV \u7F3A\u5C11 url / username / password \u5217",UNKNOWN:"\u64CD\u4F5C\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5"};function y(e){let t=e instanceof Error?e.message:"";return ne[t]??"\u64CD\u4F5C\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5"}async function h(e){let t=await chrome.runtime.sendMessage(e);if(!t||t.ok!==!0)throw new Error(t?.error??"UNKNOWN");return t}function d(e){return e.replace(/[&<>"']/g,t=>{switch(t){case"&":return"&amp;";case"<":return"&lt;";case">":return"&gt;";case'"':return"&quot;";default:return"&#39;"}})}var c={lock:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.6"/><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"/></svg>',lockLarge:'<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.6"/><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"/></svg>',search:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16.2 16.2L20.5 20.5"/></svg>',plus:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M12 5.5v13M5.5 12h13"/></svg>',key:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="12" r="3.6"/><path d="M11.6 12H20M17.2 12v3.2M20 12v2.2"/></svg>',settings:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h9M18.5 7H20M4 12h3.5M12 12h8M4 17h10M19.5 17H20"/><circle cx="15.5" cy="7" r="2"/><circle cx="9.5" cy="12" r="2"/><circle cx="16.5" cy="17" r="2"/></svg>',more:'<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5.5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="18.5" r="1.5"/></svg>',x:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',eye:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.6"/></svg>',eyeOff:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.6"/><path d="M4 4l16 16"/></svg>',dice:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="9" cy="9" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="9" r="1.2" fill="currentColor" stroke="none"/><circle cx="9" cy="15" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="15" r="1.2" fill="currentColor" stroke="none"/></svg>',copy:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2.4"/><path d="M15 5.5H6.5A1.5 1.5 0 0 0 5 7v8.5"/></svg>',trash:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9.5 7V5h5v2M7 7l1 12h8l1-12"/></svg>',refresh:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4.5V9h-4.5"/></svg>'},G=0;function u(e){w.textContent=e,w.hidden=!1,requestAnimationFrame(()=>w.classList.add("show")),window.clearTimeout(G),G=window.setTimeout(()=>{w.classList.remove("show"),window.setTimeout(()=>{w.hidden=!0},220)},1900)}async function z(e,t){if(!e){u("\u6CA1\u6709\u53EF\u590D\u5236\u7684\u5185\u5BB9");return}try{await navigator.clipboard.writeText(e),u(`${t}\u5DF2\u590D\u5236`),window.setTimeout(()=>{document.hasFocus()&&navigator.clipboard.writeText("").catch(()=>{})},3e4)}catch{u("\u590D\u5236\u5931\u8D25\uFF0C\u8BF7\u624B\u52A8\u9009\u62E9")}}function Z(){let e=a.query.trim().toLowerCase();return e?a.entries.filter(t=>[t.label,t.username,t.note??"",t.domain,t.host].some(o=>o.toLowerCase().includes(e))):a.entries}function K(e,t){let o=t.trim();if(!o)return d(e);let n=e.toLowerCase(),r=o.toLowerCase();if(!n.includes(r))return d(e);let i="",p=0,s=n.indexOf(r);for(;s>=0;)i+=d(e.slice(p,s)),i+=`<mark>${d(e.slice(s,s+r.length))}</mark>`,p=s+r.length,s=n.indexOf(r,p);return i+d(e.slice(p))}function re(e,t){let o=B(e.label||e.username||e.domain,t),n=H(e.label,e.username,e.domain),r=t===0&&e.lastUsedAt>0,i=a.query.trim(),p=[e.label,e.username,e.note].filter(Boolean).join(" \xB7 ");return`
    <div class="row" data-id="${e.id}" tabindex="0" role="button" aria-label="\u586B\u5165 ${d(e.label)}" title="${d(p)}">
      <div class="avatar" style="--h:${o}">${d(n)}</div>
      <div class="row-main">
        <div class="row-title">
          <span class="label">${K(e.label,i)}</span>
          ${r?'<span class="pill">\u4E0A\u6B21</span>':""}
        </div>
        <div class="row-sub"><span class="who">${K(e.username,i)}</span><span class="dot">\xB7</span><span class="time">${P(e.lastUsedAt)}</span></div>
      </div>
      <div class="row-tools">
        <button class="icon-btn copy" data-act="copy-pass" data-id="${e.id}" title="\u590D\u5236\u5BC6\u7801" aria-label="\u590D\u5236\u5BC6\u7801">${c.copy}</button>
        <button class="icon-btn more" data-act="edit" data-id="${e.id}" title="\u7F16\u8F91" aria-label="\u7F16\u8F91">${c.more}</button>
      </div>
    </div>
  `}function ae(){return a.host?a.query?`
      <div class="empty">
        <div class="empty-icon">${c.search}</div>
        <h2>\u6CA1\u6709\u5339\u914D\u7684\u8D26\u53F7</h2>
        <p>\u8BD5\u8BD5\u6807\u7B7E\u3001\u767B\u5F55\u540D\u6216\u5907\u6CE8\u91CC\u7684\u5173\u952E\u8BCD\u3002</p>
      </div>
    `:`
    <div class="empty">
      <div class="empty-icon">${c.key}</div>
      <h2>\u8FD8\u6CA1\u6709\u8FD9\u4E2A\u7AD9\u70B9\u7684\u8BB0\u5F55</h2>
      <p>\u767B\u5F55\u4E00\u6B21\uFF0CSiteKey \u4F1A\u95EE\u4F60\u8981\u4E0D\u8981\u4FDD\u5B58\uFF1B\u4E5F\u53EF\u4EE5\u73B0\u5728\u624B\u52A8\u6DFB\u52A0\u3002</p>
      <button class="btn primary" data-act="add">\u6DFB\u52A0\u8D26\u53F7</button>
    </div>
  `:`
      <div class="empty">
        <div class="empty-icon">${c.key}</div>
        <h2>\u8FD9\u4E2A\u9875\u9762\u4E0D\u652F\u6301\u8BB0\u5F55</h2>
        <p>\u6253\u5F00\u4E00\u4E2A http \u6216 https \u7F51\u7AD9\uFF0CSiteKey \u624D\u80FD\u8BC6\u522B\u7AD9\u70B9\u3002</p>
      </div>
    `}function U(){let e=document.getElementById("list");if(!e)return;let t=Z();e.innerHTML=t.length?t.map(re).join(""):ae();let o=document.getElementById("count");o&&(o.textContent=a.query.trim()?`${t.length} / ${a.entries.length} \u6761`:`${a.entries.length} \u6761\u8BB0\u5F55`)}function j(){let e=!!a.host,t=B(a.domain||"sitekey"),o=H(a.host||"S","","S"),n=e?a.host:"\u5F53\u524D\u9875\u9762";D.innerHTML=`
    <header class="topbar">
      <div class="site">
        <div class="tile" style="--h:${t}">${d(o)}</div>
        <div class="site-text">
          <h1 title="${d(n)}">${d(n)}</h1>
          <p id="count">${e?`${a.entries.length} \u6761\u8BB0\u5F55`:"\u8FD9\u4E2A\u9875\u9762\u4E0D\u652F\u6301\u8BB0\u5F55"}</p>
        </div>
      </div>
      <button class="icon-btn" data-act="lock" title="\u9501\u5B9A\u4FDD\u9669\u5E93" aria-label="\u9501\u5B9A\u4FDD\u9669\u5E93">${c.lock}</button>
    </header>
    ${e?`<div class="searchbar">
             ${c.search}
             <input id="search" type="text" placeholder="\u641C\u7D22\u6807\u7B7E\u6216\u8D26\u53F7" autocomplete="off" spellcheck="false" value="${d(a.query)}">
             <kbd>/</kbd>
           </div>`:""}
    <main class="list" id="list"></main>
    <footer class="bottombar">
      <button data-act="add">${c.plus}<span>\u6DFB\u52A0</span></button>
      <button data-act="gen">${c.key}<span>\u751F\u6210</span></button>
      <button data-act="settings">${c.settings}<span>\u8BBE\u7F6E</span></button>
    </footer>
  `,U()}function ie(){D.innerHTML=`
    <div class="hero">
      <div class="logo">${c.lockLarge}</div>
      <h1>\u521B\u5EFA\u4E3B\u5BC6\u7801</h1>
      <p>\u53EA\u5B58\u5728\u4F60\u7684\u8111\u5B50\u91CC\u3002SiteKey \u4E0D\u4E0A\u4F20\u3001\u4E0D\u6258\u7BA1\uFF0C\u4E5F\u65E0\u6CD5\u5E2E\u4F60\u627E\u56DE\u3002</p>
    </div>
    <form class="stack" id="setup-form">
      <input class="field" id="setup-pw" type="password" placeholder="\u4E3B\u5BC6\u7801\uFF08\u81F3\u5C11 8 \u4F4D\uFF09" autocomplete="new-password">
      <input class="field" id="setup-pw2" type="password" placeholder="\u518D\u8F93\u4E00\u6B21" autocomplete="new-password">
      <div class="strength" id="strength"><span></span><span></span><span></span><span></span></div>
      <div class="error" id="setup-error" hidden></div>
      <button class="btn primary block" type="submit">\u521B\u5EFA\u4FDD\u9669\u5E93</button>
      <p class="hint">\u5FD8\u8BB0\u4E3B\u5BC6\u7801\u7B49\u4E8E\u6570\u636E\u65E0\u6CD5\u6062\u590D\u3002\u5EFA\u8BAE\u521B\u5EFA\u540E\u7ACB\u5373\u5BFC\u51FA\u4E00\u4EFD\u52A0\u5BC6\u5907\u4EFD\u3002</p>
    </form>
  `;let e=document.getElementById("setup-pw");setTimeout(()=>e?.focus(),60)}function se(){D.innerHTML=`
    <div class="hero">
      <div class="logo">${c.lockLarge}</div>
      <h1>SiteKey \u5DF2\u9501\u5B9A</h1>
      <p>\u8F93\u5165\u4E3B\u5BC6\u7801\u7EE7\u7EED</p>
    </div>
    <form class="stack" id="unlock-form">
      <input class="field" id="unlock-pw" type="password" placeholder="\u4E3B\u5BC6\u7801" autocomplete="current-password">
      <div class="error" id="unlock-error" hidden></div>
      <button class="btn primary block" type="submit">\u89E3\u9501</button>
      <p class="hint">\u5BC6\u94A5\u53EA\u4FDD\u5B58\u5728\u672C\u6B21\u6D4F\u89C8\u5668\u4F1A\u8BDD\u7684\u5185\u5B58\u91CC\uFF0C\u5173\u95ED\u6D4F\u89C8\u5668\u5373\u5931\u6548\u3002</p>
    </form>
  `;let e=document.getElementById("unlock-pw");setTimeout(()=>e?.focus(),60)}function E(){a.status==="uninitialized"?ie():a.status==="locked"?se():j()}async function L(){if(!a.url){a.entries=[];return}let e=await h({type:"LIST",url:a.url});a.entries=e.entries??[],e.host&&(a.host=e.host),e.domain&&(a.domain=e.domain)}async function ce(){let t=(await chrome.tabs.query({active:!0,currentWindow:!0}))[0]?.url??"";a.url=t,a.host=_(t),a.domain=T(a.host);try{let o=await h({type:"STATUS"});a.status=o.status,a.status==="unlocked"&&await L()}catch{a.status="locked"}E(),le()}function le(){let e=new URLSearchParams(location.search).get("demo");!e||a.status!=="unlocked"||window.setTimeout(()=>{e==="editor"&&S(null),e==="generator"&&Y()},90)}function X(e){f.innerHTML=e,f.hidden=!1,v.hidden=!1,requestAnimationFrame(()=>{f.classList.add("open"),v.classList.add("open")})}function b(){f.classList.remove("open"),v.classList.remove("open"),window.setTimeout(()=>{f.classList.contains("open")||(f.hidden=!0,v.hidden=!0,f.innerHTML="")},300)}function de(e,t=""){let o=e?.scope??"smart",n=i=>o===i?"selected":"",r=a.domain||"\u5F53\u524D\u7AD9\u70B9";return`
    <div class="sheet-head">
      <h2>${e?"\u7F16\u8F91\u8D26\u53F7":"\u6DFB\u52A0\u8D26\u53F7"}</h2>
      <button class="icon-btn" data-act="close-sheet" aria-label="\u5173\u95ED">${c.x}</button>
    </div>
    <form class="stack" id="entry-form" data-id="${e?.id??""}" style="padding:0">
      <div class="field-group">
        <label>\u6807\u7B7E <span style="font-weight:400;color:var(--text-3)">\u7528\u6765\u533A\u5206\u540C\u7AD9\u70B9\u591A\u4E2A\u8D26\u53F7</span></label>
        <input class="field" name="label" maxlength="48" autocomplete="off" placeholder="\u4F8B\u5982\uFF1A\u5BA2\u6237A \xB7 \u516C\u4F17\u53F7" value="${d(e?.label??"")}">
      </div>
      <div class="field-group">
        <div class="field-label">
          <span>\u767B\u5F55\u540D</span>
          <button type="button" class="mini" data-act="copy-user" title="\u590D\u5236\u767B\u5F55\u540D">${c.copy}</button>
        </div>
        <input class="field" name="username" autocomplete="off" spellcheck="false" placeholder="\u90AE\u7BB1 / \u624B\u673A\u53F7 / \u7528\u6237\u540D" value="${d(e?.username??"")}">
      </div>
      <div class="field-group">
        <div class="field-label">
          <span>\u5BC6\u7801</span>
          <button type="button" class="mini" data-act="copy-pass" title="\u590D\u5236\u5BC6\u7801">${c.copy}</button>
        </div>
        <div class="pw-wrap">
          <input class="field" name="password" type="password" autocomplete="off" spellcheck="false" value="${d(e?.password??t)}">
          <div class="pw-tools">
            <button type="button" class="mini" data-act="toggle-pw" title="\u663E\u793A\u5BC6\u7801">${c.eye}</button>
            <button type="button" class="mini" data-act="gen-inline" title="\u751F\u6210\u5BC6\u7801">${c.dice}</button>
          </div>
        </div>
      </div>
      <div class="field-group">
        <label>\u5907\u6CE8</label>
        <input class="field" name="note" maxlength="120" autocomplete="off" placeholder="\u53EF\u9009" value="${d(e?.note??"")}">
      </div>
      <div class="field-group">
        <label>\u5339\u914D\u8303\u56F4</label>
        <select class="field" name="scope">
          <option value="smart" ${n("smart")}>\u667A\u80FD\uFF08\u63A8\u8350\uFF09</option>
          <option value="host" ${n("host")}>\u4EC5\u6B64\u57DF\u540D \xB7 ${d(a.host||"\u5F53\u524D\u57DF\u540D")}</option>
          <option value="domain" ${n("domain")}>\u6574\u4E2A\u7AD9\u70B9 \xB7 ${d(r)}</option>
          <option value="custom" ${n("custom")}>\u81EA\u5B9A\u4E49\u89C4\u5219</option>
        </select>
      </div>
      <div class="field-group" id="pattern-group" ${o==="custom"?"":"hidden"}>
        <label>\u89C4\u5219</label>
        <input class="field" name="pattern" autocomplete="off" placeholder="*.example.com" value="${d(e?.pattern??"")}">
      </div>
      <div class="actions-row">
        ${e?`<button type="button" class="btn danger" data-act="delete">${c.trash}<span>\u5220\u9664</span></button>`:""}
        <button type="submit" class="btn primary">${e?"\u4FDD\u5B58":"\u6DFB\u52A0"}</button>
      </div>
    </form>
  `}function S(e,t=""){if(!e&&!a.host){u("\u5F53\u524D\u9875\u9762\u4E0D\u652F\u6301\u8BB0\u5F55\u8D26\u53F7");return}X(de(e,t));let o=f.querySelector('input[name="label"]');window.setTimeout(()=>o?.focus(),320)}function Y(){X(`
    <div class="sheet-head">
      <h2>\u751F\u6210\u5BC6\u7801</h2>
      <button class="icon-btn" data-act="close-sheet" aria-label="\u5173\u95ED">${c.x}</button>
    </div>
    <div class="gen-output">
      <code id="gen-value">${d(k)}</code>
      <button class="mini" data-act="gen-refresh" title="\u91CD\u65B0\u751F\u6210">${c.refresh}</button>
    </div>
    <div class="gen-row">
      <label for="gen-length">\u957F\u5EA6</label>
      <input id="gen-length" type="range" min="8" max="48" value="${x}">
      <output id="gen-len">${x}</output>
    </div>
    <div class="switch-row"><span>\u5927\u5199 A-Z</span><button class="switch" role="switch" aria-checked="${m.upper}" data-key="upper"></button></div>
    <div class="switch-row"><span>\u5C0F\u5199 a-z</span><button class="switch" role="switch" aria-checked="${m.lower}" data-key="lower"></button></div>
    <div class="switch-row"><span>\u6570\u5B57 0-9</span><button class="switch" role="switch" aria-checked="${m.digits}" data-key="digits"></button></div>
    <div class="switch-row"><span>\u7B26\u53F7 !@#</span><button class="switch" role="switch" aria-checked="${m.symbols}" data-key="symbols"></button></div>
    <div class="actions-row">
      <button class="btn" data-act="gen-copy">\u590D\u5236</button>
      <button class="btn primary" data-act="gen-new">\u7528\u8FD9\u4E2A\u5BC6\u7801\u65B0\u5EFA\u8D26\u53F7</button>
    </div>
  `)}var x=20,m={...I},k=M(x,m);function pe(){let e=document.getElementById("gen-value");e&&(e.textContent=k)}function O(){k=M(x,m),pe()}async function q(e){let t=a.entries.find(o=>o.id===e);if(t)try{await h({type:"FILL",id:e}),t.lastUsedAt=Date.now(),t.useCount+=1,u("\u5DF2\u586B\u5165\u5F53\u524D\u9875\u9762"),window.setTimeout(()=>{try{window.close()}catch{}},280)}catch(o){if(o instanceof Error&&o.message==="LOCKED"){a.status="locked",b(),E();return}u(y(o))}}function ue(e){(async()=>{let t=document.getElementById("setup-pw").value,o=document.getElementById("setup-pw2").value,n=document.getElementById("setup-error"),r=e.querySelector('button[type="submit"]');if(n.hidden=!0,t.length<8){n.textContent="\u4E3B\u5BC6\u7801\u81F3\u5C11 8 \u4F4D",n.hidden=!1;return}if(t!==o){n.textContent="\u4E24\u6B21\u8F93\u5165\u4E0D\u4E00\u81F4",n.hidden=!1;return}r.disabled=!0,r.textContent="\u521B\u5EFA\u4E2D\u2026";try{await h({type:"SETUP",password:t}),a.status="unlocked",await L(),E(),u("\u4FDD\u9669\u5E93\u5DF2\u521B\u5EFA")}catch(i){n.textContent=y(i),n.hidden=!1}finally{r.disabled=!1,r.textContent="\u521B\u5EFA\u4FDD\u9669\u5E93"}})()}function me(e){(async()=>{let t=document.getElementById("unlock-pw").value,o=document.getElementById("unlock-error"),n=e.querySelector('button[type="submit"]');o.hidden=!0,n.disabled=!0,n.textContent="\u89E3\u9501\u4E2D\u2026";try{await h({type:"UNLOCK",password:t}),a.status="unlocked",await L(),E(),u("\u5DF2\u89E3\u9501")}catch(r){o.textContent=y(r),o.hidden=!1,n.disabled=!1,n.textContent="\u89E3\u9501",document.getElementById("unlock-pw")?.select()}})()}function ge(e){(async()=>{let t=e.dataset.id??"",o=new FormData(e),n=String(o.get("username")??"").trim(),r=String(o.get("password")??""),i=String(o.get("label")??"").trim(),p=String(o.get("note")??"").trim(),s=String(o.get("scope")??"smart")||"smart",l=String(o.get("pattern")??"").trim();if(!n||!r){u("\u767B\u5F55\u540D\u548C\u5BC6\u7801\u4E0D\u80FD\u4E3A\u7A7A");return}if(s==="custom"&&!l){u("\u8BF7\u586B\u5199\u81EA\u5B9A\u4E49\u89C4\u5219\uFF0C\u4F8B\u5982 *.example.com");return}try{if(t){let g=a.entries.find(Q=>Q.id===t);if(!g)throw new Error("NOT_FOUND");await h({type:"UPDATE",entry:{...g,label:i||A(n,a.domain),username:n,password:r,note:p,scope:s,pattern:s==="custom"?l:void 0}})}else await h({type:"SAVE",draft:{domain:a.domain,host:a.host,scope:s,pattern:s==="custom"?l:void 0,username:n,password:r,label:i||A(n,a.domain),note:p}});await L(),b(),j(),u(t?"\u5DF2\u4FDD\u5B58":"\u5DF2\u6DFB\u52A0")}catch(g){u(y(g))}})()}function fe(e){if(e.dataset.armed!=="1"){e.dataset.armed="1",e.textContent="\u518D\u70B9\u4E00\u6B21\u786E\u8BA4",window.setTimeout(()=>{e.isConnected&&(e.dataset.armed="0",e.innerHTML=`${c.trash}<span>\u5220\u9664</span>`)},3e3);return}(async()=>{let o=document.getElementById("entry-form")?.dataset.id??"";if(o)try{await h({type:"DELETE",id:o}),await L(),b(),j(),u("\u5DF2\u5220\u9664")}catch(n){u(y(n))}})()}function W(e){return document.getElementById("entry-form")?.elements.namedItem(e)?.value??""}function he(e){let t=e.target,o=t.closest(".switch[data-key]");if(o){let i=o.dataset.key;m={...m,[i]:!m[i]},o.setAttribute("aria-checked",String(m[i])),O();return}let n=t.closest("[data-act]");if(n){let i=n.dataset.act??"",p=n.dataset.id??"";switch(i){case"lock":(async()=>(await h({type:"LOCK"}).catch(()=>{}),a.status="locked",b(),E(),u("\u5DF2\u9501\u5B9A")))();break;case"add":S(null);break;case"gen":Y();break;case"settings":chrome.runtime.openOptionsPage();break;case"edit":S(a.entries.find(s=>s.id===p)??null);break;case"close-sheet":b();break;case"toggle-pw":{let s=document.querySelector('#entry-form input[name="password"]');if(!s)break;let l=s.type==="password";s.type=l?"text":"password",n.innerHTML=l?c.eyeOff:c.eye,n.setAttribute("title",l?"\u9690\u85CF\u5BC6\u7801":"\u663E\u793A\u5BC6\u7801");break}case"gen-inline":{let s=document.querySelector('#entry-form input[name="password"]');if(!s)break;s.value=M(20,m),s.type="text";let l=document.querySelector('[data-act="toggle-pw"]');l&&(l.innerHTML=c.eyeOff);break}case"copy-user":z(W("username"),"\u767B\u5F55\u540D");break;case"copy-pass":{let s=p?a.entries.find(l=>l.id===p):null;z(s?s.password:W("password"),"\u5BC6\u7801");break}case"delete":fe(n);break;case"gen-refresh":O();break;case"gen-copy":z(k,"\u5BC6\u7801");break;case"gen-new":b(),window.setTimeout(()=>S(null,k),260);break;default:break}return}let r=t.closest(".row[data-id]");r?.dataset.id&&q(r.dataset.id)}function be(e){e.preventDefault();let t=e.target;t.id==="setup-form"?ue(t):t.id==="unlock-form"?me(t):t.id==="entry-form"&&ge(t)}function xe(e){let t=e.target;if(t.id==="search"){a.query=t.value,U();return}if(t.id==="setup-pw"){let o=document.getElementById("strength");o&&(o.className=`strength s${N(t.value)}`);return}if(t.id==="gen-length"){x=Number(t.value);let o=document.getElementById("gen-len");o&&(o.textContent=String(x)),O();return}if(t.matches('select[name="scope"]')){let o=t.value,n=document.getElementById("pattern-group");n&&(n.hidden=o!=="custom")}}document.addEventListener("click",he);document.addEventListener("submit",be);document.addEventListener("input",xe);v.addEventListener("click",b);document.addEventListener("keydown",e=>{if(e.key==="Escape"){if(!f.hidden){b();return}if(a.query){a.query="";let t=document.getElementById("search");t&&(t.value="",t.focus()),U()}return}if(e.key==="ArrowDown"||e.key==="ArrowUp"){let t=Array.from(document.querySelectorAll(".row[data-id]"));if(!t.length)return;let o=e.target instanceof HTMLElement?e.target.closest(".row[data-id]"):null;if(!o){e.key==="ArrowDown"&&e.target instanceof HTMLInputElement&&e.target.id==="search"&&(e.preventDefault(),t[0]?.focus());return}let n=t.indexOf(o);if(n<0)return;e.preventDefault();let r=e.key==="ArrowDown"?Math.min(t.length-1,n+1):Math.max(0,n-1);t[r]?.focus();return}if(e.key==="/"&&!(e.target instanceof HTMLInputElement)){let t=document.getElementById("search");t&&(e.preventDefault(),t.focus());return}if(e.key==="Enter"&&e.target instanceof HTMLElement){let t=e.target.closest(".row[data-id]");if(t?.dataset.id){e.preventDefault(),q(t.dataset.id);return}if(e.target.id==="search"){let o=Z()[0];o&&(e.preventDefault(),q(o.id))}}});ce();})();
