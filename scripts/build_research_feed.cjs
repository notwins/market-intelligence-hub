// Static direct-link fallback uses the SAME renderer as the live card list.
'use strict';
const fs=require('node:fs'),path=require('node:path'),R=require('../site/research-feed.js');
const site=path.resolve(process.argv[2]||path.join(__dirname,'../site'));
const feed=R.validate(JSON.parse(fs.readFileSync(path.join(site,'data/research-feed.json'),'utf8')));
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>New research editions | Market Intelligence Hub</title><link rel="stylesheet" href="market-understanding/market-understanding.css"><link rel="stylesheet" href="market-understanding/published-research.css"></head><body class="market-understanding"><main class="mu-writeups"><a href="market-understanding/#main-published-research">Back to Research Explained</a><h1>New research editions</h1><p>Complete dated reports. Matching briefs are optional. ${feed.verified_at_sgt?'Verified '+feed.verified_at_sgt.replace('T',' ').replace('+08:00',' SGT'):'No editions in this feed yet.'}</p><div class="mu-writeups-grid">${R.cards(feed.records,feed.tags)}</div></main></body></html>`;
fs.writeFileSync(path.join(site,'research-feed.html'),html);console.log('Built direct-link research fallback: '+feed.records.length+' reports');
