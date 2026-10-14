'use strict';
document.getElementById('open').addEventListener('click',()=>chrome.tabs.create({url:chrome.runtime.getURL('workspace.html')}));

document.getElementById('openReverse').addEventListener('click',()=>chrome.tabs.create({url:chrome.runtime.getURL('reverse.html')}));

document.getElementById('openTemplates').addEventListener('click',()=>chrome.tabs.create({url:chrome.runtime.getURL('templates.html')}));
