// ══════════════════════════════════════════════════════
//  CONFIGURAÇÃO — lidos dos campos hidden Razor
// ══════════════════════════════════════════════════════
var KYC_CLIENT_ID  = document.getElementById('kyc_client_id')  ? document.getElementById('kyc_client_id').value  : '';
var KYC_SUBMIT_URL = document.getElementById('kyc_submit_url') ? document.getElementById('kyc_submit_url').value : '/Kyc/Submit';
var KYC_CSRF_TOKEN = document.querySelector('input[name="__RequestVerificationToken"]') 
                     ? document.querySelector('input[name="__RequestVerificationToken"]').value : '';

// ══════════════════════════════════════════════════════
//  ESTADO GLOBAL
// ══════════════════════════════════════════════════════
var SECTIONS=7, cmdState={1:false,2:false}, docFiles={}, currentLang='pt',
    currentType='singular', currentModo='interno', pdfDoc=null, titularCount=0;

var T={
  pt:{yn_yes:'Sim',yn_no:'Não',lbl_titular:'Titular',lbl_remover:'Remover',lbl_add_titular:'Adicionar Titular',
    h_cmd_btn:'Autenticar com Chave Móvel Digital',bar_saved:'Progresso guardado',
    bar_sub:'Os dados são guardados automaticamente neste browser.',bar_close:'Fechar',
    bar_submit:'Submeter formulário',bar_save:'Guardar progresso',prog_section:'Secção',prog_of:'de',
    submit_ok:'✓ Formulário submetido',submit_pending:'⏳ A submeter...',
    docs_missing:'⚠ Documentos em falta',docs_missing_sub:'Faltam: {0}.',
    save_ok:'✓ Progresso guardado',save_time:'Guardado às ',
    toast_title:'Campos obrigatórios em falta',
    type_singular:'Pessoa Singular',type_coletiva:'Pessoa Coletiva'},
  en:{yn_yes:'Yes',yn_no:'No',lbl_titular:'Holder',lbl_remover:'Remove',lbl_add_titular:'Add Holder',
    h_cmd_btn:'Authenticate with Mobile Digital Key',bar_saved:'Progress saved',
    bar_sub:'Data is automatically saved in this browser.',bar_close:'Close',
    bar_submit:'Submit form',bar_save:'Save progress',prog_section:'Section',prog_of:'of',
    submit_ok:'✓ Form submitted',submit_pending:'⏳ Submitting...',
    docs_missing:'⚠ Documents missing',docs_missing_sub:'Missing: {0}.',
    save_ok:'✓ Progress saved',save_time:'Saved at ',
    toast_title:'Required fields missing',
    type_singular:'Individual',type_coletiva:'Legal Entity'}
};

// ══════════════════════════════════════════════════════
//  SUBMISSÃO → CONTROLLER C# (substituição do placeholder)
// ══════════════════════════════════════════════════════
function submitForm(){
  var fe = validateRequired();
  if(fe.length > 0){ showToast(fe); fe[0].el.scrollIntoView({behavior:'smooth',block:'center'}); return; }
  var dm = validateDocs();
  var d  = T[currentLang];
  if(dm.length > 0){
    var bt=document.getElementById('bar-title');
    bt.textContent=d.docs_missing; bt.style.color='#555';
    document.getElementById('bar-sub').textContent=d.docs_missing_sub.replace('{0}',dm.join(' · '));
    setTimeout(function(){bt.textContent=d.bar_saved;bt.style.color='';document.getElementById('bar-sub').textContent=d.bar_sub;},7000);
    return;
  }

  // Recolher todos os dados + ficheiros num FormData
  var form = new FormData();

  // Campos de texto
  document.querySelectorAll('input[type=text],input[type=date],input[type=month],input[type=email],input[type=tel],select,textarea').forEach(function(el){
    if(el.name) form.append(el.name, el.value || '');
  });

  // Campos ocultos de contexto
  form.append('clientId',   KYC_CLIENT_ID);
  form.append('_type',      currentType);
  form.append('_lang',      currentLang);
  form.append('_modo',      currentModo);
  form.append('pep_flag',   (!!document.querySelector('.yn-btn.yes.on[onclick*="p1d"]') ||
                              !!document.querySelector('.yn-btn.yes.on[onclick*="p2d"]') ||
                              !!document.querySelector('.yn-btn.yes.on[onclick*="p3d"]') ||
                              !!document.querySelector('.yn-btn.yes.on[onclick*="p4d"]')).toString());

  // Ficheiros carregados
  Object.keys(docFiles).forEach(function(k){
    if(docFiles[k] && docFiles[k].length){
      docFiles[k].forEach(function(f){ form.append('file_'+k, f, f.name); });
    }
  });
  // Assinaturas físicas
  ['upload-1','upload-2'].forEach(function(id,i){
    var inp = document.getElementById(id);
    if(inp && inp.files && inp.files[0]) form.append('file_sign_'+(i+1), inp.files[0], inp.files[0].name);
  });

  // Actualizar UI — a submeter
  var bt=document.getElementById('bar-title');
  bt.textContent=d.submit_pending; bt.style.color='#555';
  document.getElementById('bar-sub').textContent='';

  fetch(KYC_SUBMIT_URL, {
    method: 'POST',
    headers: { 'RequestVerificationToken': KYC_CSRF_TOKEN },
    body: form
  })
  .then(function(r){
    if(!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  })
  .then(function(data){
    // Sucesso
    bt.textContent = d.submit_ok; bt.style.color='var(--ok)';
    document.getElementById('bar-sub').textContent = data.ref || '';
    // Mostrar bloco de sucesso
    var s = document.getElementById('kyc-success');
    var sr = document.getElementById('kyc-success-ref');
    if(s){ s.classList.add('show'); s.scrollIntoView({behavior:'smooth'}); }
    if(sr) sr.textContent = data.ref || '';
    // Limpar localStorage desta ref
    try{ localStorage.removeItem('alg_kyc'); }catch(e){}
  })
  .catch(function(err){
    bt.textContent = '⚠ Erro na submissão'; bt.style.color='var(--err)';
    document.getElementById('bar-sub').textContent = 'Tente novamente ou contacte o suporte.';
    var errEl = document.getElementById('kyc-error');
    if(errEl){ errEl.textContent = 'Erro: ' + err.message; errEl.classList.add('show'); }
  });
}

// ══════════════════════════════════════════════════════
//  RESTANTE LÓGICA (100% inalterada do index.html)
// ══════════════════════════════════════════════════════
function toggleGdpr(){var b=document.getElementById('gdpr-body'),c=document.getElementById('gdpr-chevron'),o=b.classList.contains('open');b.classList.toggle('open',!o);c.style.transform=o?'rotate(0deg)':'rotate(180deg)';}
function toggleModo(){currentModo=currentModo==='interno'?'cliente':'interno';applyModo();}
function applyModo(){
  var isC=currentModo==='cliente',d=T[currentLang];
  document.body.classList.toggle('cliente-mode',isC);
  var bn=document.getElementById('modo-banner');bn.classList.toggle('cliente-mode',isC);
  document.getElementById('modo-label').textContent=isC?d.modo_cliente||'Modo Cliente':d.modo_interno||'Modo Interno';
  document.getElementById('modo-desc').textContent=isC?'— negócio só de leitura':'— todas as secções visíveis e editáveis';
  document.getElementById('modo-btn-label').textContent=isC?'Voltar ao Modo Interno':'Mudar para Modo Cliente';
  try{localStorage.setItem('alg_modo',currentModo);}catch(e){}
}
function setLang(lang){
  currentLang=lang;
  document.getElementById('toast-title').textContent=T[lang].toast_title;
  document.getElementById('type-singular-lbl').textContent=T[lang].type_singular;
  document.getElementById('type-coletiva-lbl').textContent=T[lang].type_coletiva;
  document.getElementById('bar-close').textContent=T[lang].bar_close;
  document.getElementById('bar-submit').textContent=T[lang].bar_submit;
  document.getElementById('bar-save').textContent=T[lang].bar_save;
  document.getElementById('lbl-add-titular').textContent=T[lang].lbl_add_titular;
  document.getElementById('cmd-label-1').textContent=T[lang].h_cmd_btn;
  document.getElementById('cmd-label-2').textContent=T[lang].h_cmd_btn;
  document.getElementById('yn-yes-1').textContent=T[lang].yn_yes;
  document.getElementById('yn-no-1').textContent=T[lang].yn_no;
  document.getElementById('yn-yes-rep').textContent=T[lang].yn_yes;
  document.getElementById('yn-no-rep').textContent=T[lang].yn_no;
  applyModo();updateProgress();
}
function setType(type){
  currentType=type;
  document.getElementById('btn-singular').classList.toggle('active',type==='singular');
  document.getElementById('btn-coletiva').classList.toggle('active',type==='coletiva');
  document.getElementById('section-singular').style.display=type==='singular'?'':'none';
  document.getElementById('section-coletiva').style.display=type==='coletiva'?'':'none';
  document.getElementById('docs-singular').style.display=type==='singular'?'':'none';
  document.getElementById('docs-coletiva').style.display=type==='coletiva'?'':'none';
  document.querySelectorAll('#section-singular [data-req-pt]').forEach(function(el){
    if(type==='singular')el.setAttribute('data-req',el.getAttribute('data-req-'+currentLang));
    else{el.removeAttribute('data-req');el.classList.remove('err-field');}
  });
  document.querySelectorAll('#section-coletiva [data-req-pt]').forEach(function(el){
    if(type==='coletiva')el.setAttribute('data-req',el.getAttribute('data-req-'+currentLang));
    else{el.removeAttribute('data-req');el.classList.remove('err-field');}
  });
  updateProgress();try{localStorage.setItem('alg_kyc_type',type);}catch(e){}
}
function toggleChk(el){el.classList.toggle('on');updateProgress();}
function toggleChkOutro(el,id){el.classList.toggle('on');var o=document.getElementById(id);if(el.classList.contains('on')){o.classList.add('show');o.querySelector('input').focus();}else o.classList.remove('show');updateProgress();}
function toggleRad(el,grp){document.querySelectorAll('#'+grp+' .opt').forEach(function(x){x.classList.remove('on');});el.classList.add('on');updateProgress();}
function ynToggle(btn,id,type){
  btn.closest('.yn').querySelectorAll('.yn-btn').forEach(function(b){b.classList.remove('on');});btn.classList.add('on');
  var det=document.getElementById(id);
  if(type==='yes'){det.classList.add('open');det.querySelectorAll('[data-req-pt]').forEach(function(el){el.setAttribute('data-req',el.getAttribute('data-req-'+currentLang));});}
  else{det.classList.remove('open');det.querySelectorAll('input,select').forEach(function(i){i.value='';i.classList.remove('err-field');});det.querySelectorAll('.opt').forEach(function(o){o.classList.remove('on');});det.querySelectorAll('.f-err').forEach(function(e){e.classList.remove('show');});det.querySelectorAll('[data-req]').forEach(function(el){el.removeAttribute('data-req');});}
  updateProgress();
}
function toggleAnnex(){var open=document.getElementById('anx-body').classList.toggle('open');document.getElementById('anx-icon').textContent=open?'−':'+';document.getElementById('anx-txt').textContent=open?(currentLang==='pt'?'Fechar definições legais':'Close legal definitions'):(currentLang==='pt'?'Ver definições legais':'View legal definitions');}
function toggleIssuerOther(sel,outroId){var o=document.getElementById(outroId);if(sel.value==='outro'){o.classList.add('show');o.querySelector('input').focus();}else o.classList.remove('show');}
function addTitular(){
  titularCount++;var n=titularCount,d=T[currentLang];
  var html='<div class="titular-block" id="titular-'+n+'"><div class="titular-hdr"><span class="titular-lbl">'+d.lbl_titular+' '+n+'</span><button class="titular-remove" onclick="removeTitular('+n+')">'+d.lbl_remover+'</button></div><div class="g3">'+
    '<div class="f s2"><label class="req">Nome</label><input type="text" name="tit_'+n+'_nome" data-req-pt="Nome Titular '+n+'" data-req-en="Holder '+n+' Name"><span class="f-err">Campo obrigatório</span></div>'+
    '<div class="f"><label class="req">Cargo</label><input type="text" name="tit_'+n+'_cargo" data-req-pt="Cargo Titular '+n+'" data-req-en="Holder '+n+' Position"><span class="f-err">Campo obrigatório</span></div>'+
    '<div class="f"><label>% Capital detido</label><input type="text" name="tit_'+n+'_capital"></div>'+
    '<div class="f"><label>Beneficiário Efetivo?</label><div class="opts" id="tit-be-'+n+'"><div class="opt" onclick="toggleRad(this,\'tit-be-'+n+'\')"><div class="odot"></div>'+d.yn_yes+'</div><div class="opt" onclick="toggleRad(this,\'tit-be-'+n+'\')"><div class="odot"></div>'+d.yn_no+'</div></div></div>'+
    '<div class="f"><label class="req">Nacionalidade</label><input type="text" name="tit_'+n+'_nac1" data-req-pt="Nac. Titular '+n+'" data-req-en="Holder '+n+' Nat."><span class="f-err">Campo obrigatório</span></div>'+
    '<div class="f"><label>Outras Nacionalidades</label><input type="text" name="tit_'+n+'_nac2"></div>'+
    '<div class="f"><label class="req">N.º Doc. Id.</label><input type="text" name="tit_'+n+'_docnum" data-req-pt="N.º Doc. Titular '+n+'" data-req-en="Holder '+n+' Doc No."><span class="f-err">Campo obrigatório</span></div>'+
    '<div class="f"><label class="req">NIF Nacional</label><input type="text" name="tit_'+n+'_nif" data-req-pt="NIF Titular '+n+'" data-req-en="Holder '+n+' NIF"><span class="f-err">Campo obrigatório</span></div>'+
    '<div class="f s3"><label class="req">Residência Permanente e País</label><input type="text" name="tit_'+n+'_res" data-req-pt="Residência Titular '+n+'" data-req-en="Holder '+n+' Residence"><span class="f-err">Campo obrigatório</span></div>'+
    '</div></div>';
  var c=document.getElementById('titulares-container'),div=document.createElement('div');div.innerHTML=html;c.appendChild(div.firstChild);
  if(currentType==='coletiva')c.querySelectorAll('#titular-'+n+' [data-req-pt]').forEach(function(el){el.setAttribute('data-req',el.getAttribute('data-req-'+currentLang));});
  updateProgress();
}
function removeTitular(n){var el=document.getElementById('titular-'+n);if(el)el.parentNode.removeChild(el);updateProgress();}
var UPLOAD_ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><path d="M12 16V4M8 8l4-4 4 4"/><path d="M3 18v2a1 1 0 001 1h16a1 1 0 001-1v-2"/></svg>';
function docFileSet(input,key){
  if(!input.files||!input.files.length)return;
  var files=Array.from(input.files);docFiles[key]=files;
  var btn=document.getElementById('upbtn-'+key);
  if(btn){btn.style.borderColor='var(--ok)';btn.style.color='var(--ok)';btn.innerHTML='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><polyline points="3 8 6 11 13 4"/></svg>';var inp=document.createElement('input');inp.type='file';inp.accept='.pdf,.jpg,.jpeg,.png';inp.multiple=true;inp.style.display='none';inp.onchange=function(){docFileSet(inp,key);};btn.appendChild(inp);}
  var meta=document.getElementById('upmeta-'+key),list=document.getElementById('upfiles-'+key);
  if(meta&&list){list.textContent='✓ '+files.map(function(f){return f.name;}).join(' · ');meta.style.display='flex';}
  updateProgress();
}
function validateRequired(){
  var errors=[];
  document.querySelectorAll('.err-field').forEach(function(el){el.classList.remove('err-field');});
  document.querySelectorAll('.f-err.show').forEach(function(el){el.classList.remove('show');});
  document.querySelectorAll('[data-req]').forEach(function(el){
    if(currentModo==='cliente'&&el.closest('.readonly-section'))return;
    if(!el.value.trim()){el.classList.add('err-field');var msg=el.nextElementSibling;if(msg&&msg.classList.contains('f-err'))msg.classList.add('show');errors.push({label:el.getAttribute('data-req'),el:el});}
  });
  return errors;
}
function validateDocs(){
  var missing=[];
  var reqDocs=currentType==='singular'?['f1','f2','f4','f6']:['cc1','cc2','cc5'];
  reqDocs.forEach(function(key){var li=document.getElementById('li-'+key);if(!li)return;if(!(docFiles[key]&&docFiles[key].length))missing.push(li.querySelector('.ck-label').textContent.replace('*','').trim().substring(0,50)+'…');});
  var fundKeys=['g1','g2','g3','g4','g5','g6'];
  var anyChecked=fundKeys.some(function(k){return document.getElementById('ckchk-'+k)&&document.getElementById('ckchk-'+k).classList.contains('on');});
  if(!anyChecked){document.getElementById('uperr-fundos').style.display='block';missing.push('Comprovativo origem de fundos (selecione pelo menos um)');}
  else{
    document.getElementById('uperr-fundos').style.display='none';
    fundKeys.forEach(function(k){
      var chk=document.getElementById('ckchk-'+k);
      if(chk&&chk.classList.contains('on')){
        var hasFile=docFiles[k]&&docFiles[k].length;
        var btn=document.getElementById('upbtn-'+k),errEl=document.getElementById('uperr-'+k),meta=document.getElementById('upmeta-'+k);
        if(!hasFile){if(btn)btn.classList.add('required-upload');if(errEl){errEl.classList.add('show');meta.style.display='flex';}var li=document.getElementById('li-'+k);missing.push((li?li.querySelector('.ck-label').textContent.trim().substring(0,40)+'…':'Documento')+'— upload em falta');}
        else{if(btn)btn.classList.remove('required-upload');if(errEl)errEl.classList.remove('show');}
      }
    });
  }
  return missing;
}
function showToast(errors){
  var list=document.getElementById('toast-list');list.innerHTML='';
  errors.forEach(function(e){var li=document.createElement('li');li.textContent=e.label;if(e.el){li.onclick=function(){e.el.scrollIntoView({behavior:'smooth',block:'center'});e.el.focus();closeToast();};}list.appendChild(li);});
  var t=document.getElementById('val-toast');t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(closeToast,12000);
}
function closeToast(){document.getElementById('val-toast').classList.remove('show');}
function closeBar(){document.getElementById('bar').style.display='none';document.getElementById('bar-tab').style.display='flex';}
function openBar(){document.getElementById('bar').style.display='flex';document.getElementById('bar-tab').style.display='none';}
function saveProgress(){
  var data={};document.querySelectorAll('input[type=text],input[type=date],input[type=month],input[type=email],input[type=tel],select,textarea').forEach(function(el){if(el.name)data[el.name]=el.value;});
  try{localStorage.setItem('alg_kyc',JSON.stringify(data));var d=T[currentLang],bt=document.getElementById('bar-title');bt.textContent=d.save_ok;bt.style.color='var(--ok)';document.getElementById('bar-sub').textContent=d.save_time+new Date().toLocaleTimeString(currentLang==='pt'?'pt-PT':'en-GB',{hour:'2-digit',minute:'2-digit'});setTimeout(function(){bt.textContent=d.bar_saved;bt.style.color='';},3000);}catch(e){}
}
function loadProgress(){
  try{var saved=localStorage.getItem('alg_kyc');if(!saved)return;var data=JSON.parse(saved);document.querySelectorAll('input[type=text],input[type=date],input[type=month],input[type=email],input[type=tel],select,textarea').forEach(function(el){if(el.name&&data[el.name]!==undefined)el.value=data[el.name];});updateProgress();}catch(e){}
}
function updateProgress(){
  var inp=document.querySelectorAll('input[type=text],input[type=date],input[type=month],input[type=email],input[type=tel]');
  var done=0;inp.forEach(function(i){if(i.value.trim())done++;});
  var sel=document.querySelectorAll('.opt.on,.yn-btn.on').length;
  var cmd=(cmdState[1]?1:0)+(cmdState[2]?1:0);
  var pct=inp.length?Math.min(100,Math.round((done+sel*0.5+cmd*2)/inp.length*100)):0;
  document.getElementById('prog-bar').style.width=pct+'%';document.getElementById('prog-pct').textContent=pct+'%';
  var sec=Math.min(SECTIONS,Math.floor(pct/100*SECTIONS)+1),d=T[currentLang];
  document.getElementById('prog-label').textContent=d.prog_section+' '+sec+' '+d.prog_of+' '+SECTIONS;
  document.querySelectorAll('.sd').forEach(function(dot,i){dot.className='sd'+(i<sec-1?' done':i===sec-1?' active':'');});
}
function openCmd(n){
  var nome=(document.getElementById('h'+n+'_nome')||{}).value||'';
  var status=document.getElementById('cmd-status-'+n);
  document.getElementById('cmd-label-'+n).textContent=currentLang==='pt'?'A aguardar confirmação…':'Awaiting confirmation…';
  status.className='cmd-st pending';
  status.innerHTML=(currentLang==='pt'?'Portal CMD aberto.':'CMD portal opened.')+(nome?' ('+nome+')':'')+'<br><br><button class="confirm-btn" onclick="confirmCmd('+n+')">'+(currentLang==='pt'?'✓ Confirmar':'✓ Confirm')+'</button><button class="cancel-btn" onclick="cancelCmd('+n+')">'+(currentLang==='pt'?'Cancelar':'Cancel')+'</button>';
  var a=document.createElement('a');a.href='https://autenticacao.gov.pt';a.target='_blank';a.rel='noopener';document.body.appendChild(a);a.click();document.body.removeChild(a);
}
function confirmCmd(n){cmdState[n]=true;var nome=(document.getElementById('h'+n+'_nome')||{}).value||'';var st=document.getElementById('cmd-status-'+n);st.className='cmd-st done';st.innerHTML='✓ '+(currentLang==='pt'?'Autenticado':'Authenticated')+(nome?' — '+nome:'');document.getElementById('cmd-btn-'+n).style.cssText='border-color:var(--ok);color:var(--ok);background:var(--ok-bg)';document.getElementById('cmd-label-'+n).textContent=currentLang==='pt'?'Autenticação concluída':'Authentication complete';updateProgress();}
function cancelCmd(n){document.getElementById('cmd-status-'+n).className='cmd-st pending';document.getElementById('cmd-status-'+n).textContent=currentLang==='pt'?'Autenticação pendente.':'Authentication pending.';document.getElementById('cmd-label-'+n).textContent=T[currentLang].h_cmd_btn;}
function handleUpload(input,n){if(input.files&&input.files[0]){var area=document.getElementById('upload-area-'+n),nameEl=document.getElementById('upload-name-'+n);if(area){area.classList.add('has-file');area.querySelector('p').textContent=currentLang==='pt'?'Documento carregado':'Document uploaded';}if(nameEl){nameEl.style.display='block';nameEl.textContent='✓ '+input.files[0].name;}updateProgress();}}
function closePDFModal(){document.getElementById('pdf-modal').classList.remove('show');pdfDoc=null;}
function downloadPDF(){if(pdfDoc){var f=collectFields();pdfDoc.save('ALGEBRA_KYC_'+(f['ref_interna']||'form').replace(/[^a-zA-Z0-9_-]/g,'_')+'.pdf');}}
function collectFields(){var f={};document.querySelectorAll('input[type=text],input[type=date],input[type=month],input[type=email],input[type=tel],select').forEach(function(el){if(el.name&&el.value.trim())f[el.name]=el.value.trim();});var refEl=document.getElementById('ref_interna');if(refEl&&!f['ref_interna'])f['ref_interna']=refEl.value||genRef();return f;}
function fv(f,k){return f[k]||'—';}
function getSelected(grpId){var labels=[];document.querySelectorAll('#'+grpId+' .opt.on').forEach(function(el){labels.push(el.textContent.trim());});return labels.join(', ')||'—';}
function buildPreviewHTML(f){
  function row(l,v){return '<div class="pdf-row"><div class="pdf-row-lbl">'+l+'</div><div class="pdf-row-val">'+(v||'—')+'</div></div>';}
  function sec(t){return '<div class="pdf-sec">'+t+'</div>';}
  var html='<div class="pdf-preview-page"><div class="pdf-wm">CONFIDENTIAL</div>';
  html+='<div class="pdf-hdr-band"><svg height="38" viewBox="0 0 220 52" xmlns="http://www.w3.org/2000/svg"><rect x="60" y="1" width="100" height="12" fill="none" stroke="#111" stroke-width="0.8"/><text x="110" y="9.5" font-family="Arial,sans-serif" font-size="5" font-weight="700" letter-spacing="2.5" fill="#111" text-anchor="middle">LX PARTNERS</text><text x="110" y="31" font-family="Arial,sans-serif" font-size="17" font-weight="700" letter-spacing="5" fill="#111" text-anchor="middle">ALGEBRA</text><line x1="2" y1="35" x2="218" y2="35" stroke="#111" stroke-width="0.7"/><text x="110" y="48" font-family="Arial,sans-serif" font-size="12" font-weight="300" letter-spacing="8" fill="#111" text-anchor="middle">CAPITAL</text></svg><div class="pdf-meta"><strong>KYC</strong>NIPC 513912878<br><em>Ref: '+fv(f,'ref_interna')+'</em></div></div>';
  html+='<div class="pdf-inner">';
  html+=sec('A — Negócio')+row('Propósito',fv(f,'a_proposito'))+row('Montante',fv(f,'a_montante')+' €')+row('Sinal',fv(f,'a_sinal')+' €')+row('Origem Fundos',getSelected('fund-opts'))+row('IBAN Transferência',fv(f,'a_transf_iban'));
  if(currentType==='singular'){html+=sec('B — Proponente Singular')+row('Nome',fv(f,'c1_nome'))+row('Data Nascimento',fv(f,'c1_nasc'))+row('NIF',fv(f,'c1_nif'))+row('Residência',fv(f,'c1_res1'))+row('Profissão',fv(f,'c1_prof'))+row('Telefone',fv(f,'c1_tel'))+row('Email',fv(f,'c1_email'));}
  else{html+=sec('B — Proponente Coletivo')+row('Denominação Social',fv(f,'cc_denom'))+row('NIPC',fv(f,'cc_nipc'))+row('Sede',fv(f,'cc_sede'))+row('Forma Jurídica',fv(f,'cc_forma'))+row('RCBE',fv(f,'cc_rcbe'));}
  html+=sec('Assinaturas')+'<div class="pdf-sign-grid"><div><div class="pdf-sign-lbl">Proponente 1</div><p style="font-size:9px">Nome: <strong>'+fv(f,'h1_nome')+'</strong></p><p style="font-size:9px">Data: '+fv(f,'h1_data')+'</p><div class="pdf-sign-line"></div></div><div><div class="pdf-sign-lbl">Proponente 2 / Rep. Legal</div><p style="font-size:9px">Nome: <strong>'+fv(f,'h2_nome')+'</strong></p><p style="font-size:9px">Data: '+fv(f,'h2_data')+'</p><div class="pdf-sign-line"></div></div></div>';
  html+='</div><div class="pdf-ftr"><span>ALGEBRA CAPITAL, LDA · Av. da Liberdade, 110, 5.º, 1250-146 Lisboa</span><span>algebracapital.pt</span></div></div>';
  return html;
}
function openDraftPDF(){
  var f=collectFields();
  document.getElementById('pdf-preview-wrap').innerHTML=buildPreviewHTML(f);
  document.getElementById('pdf-modal').classList.add('show');
  if(window.jspdf&&window.jspdf.jsPDF) buildPDF();
}
function runExport(skip){if(skip){openDraftPDF();return;}var errors=validateRequired();if(errors.length>0){showToast(errors);errors[0].el.scrollIntoView({behavior:'smooth',block:'center'});return;}openDraftPDF();}
function buildPDF(){
  if(!window.jspdf||!window.jspdf.jsPDF)return;
  var doc=new window.jspdf.jsPDF({unit:'mm',format:'a4'});
  var f=collectFields(),LM=16,RM=194,PW=RM-LM,y=0,LH=5.2,PAGE_H=280;
  function np(){doc.addPage();y=46;wm();hdr();}
  function ck(n){if(y+(n||LH)>PAGE_H)np();}
  function wm(){doc.saveGraphicsState();doc.setGState(new doc.GState({opacity:0.03}));doc.setFontSize(52);doc.setFont('helvetica','bold');doc.setTextColor(0,0,0);doc.text('CONFIDENTIAL',105,160,{align:'center',angle:45});doc.restoreGraphicsState();doc.setTextColor(0,0,0);doc.setFillColor(255,255,255);doc.setDrawColor(0,0,0);doc.setLineWidth(0.3);}
  function hdr(){
    doc.setFillColor(255,255,255);doc.rect(0,0,210,42,'F');
    doc.setDrawColor(220,220,220);doc.setLineWidth(0.3);doc.line(0,40,210,40);
    if(window._algLogoB64){try{doc.addImage(window._algLogoB64,'PNG',LM,4,56,14);}catch(e){}}
    doc.setFontSize(7.5);doc.setFont('helvetica','bold');doc.setTextColor(17,17,17);doc.text('KYC',RM,14,{align:'right'});
    doc.setFontSize(6.5);doc.setFont('helvetica','normal');doc.setTextColor(150,150,150);doc.text('NIPC 513912878  ·  algebracapital.pt',RM,21,{align:'right'});
    doc.setTextColor(120,120,120);doc.text('Ref: '+fv(f,'ref_interna'),RM,28,{align:'right'});
  }
  function ftr(){var pg=doc.getNumberOfPages();doc.setPage(pg);doc.setFillColor(255,255,255);doc.rect(0,285,210,12,'F');doc.setDrawColor(220,220,220);doc.setLineWidth(0.3);doc.line(0,286,210,286);doc.setFontSize(6.5);doc.setFont('helvetica','normal');doc.setTextColor(150,150,150);doc.text('ALGEBRA CAPITAL, LDA  ·  Av. da Liberdade, 110, 5.º, 1250-146 Lisboa  ·  (+351) 211 316 224',LM,293);doc.setTextColor(180,180,180);doc.text('? / ?',RM,293,{align:'right'});}
  function sec(t){ck(14);y+=6;doc.setDrawColor(50,50,50);doc.setLineWidth(0.3);doc.line(LM,y,RM,y);y+=5;doc.setFontSize(9);doc.setFont('helvetica','bold');doc.setTextColor(50,50,50);doc.text(t.toUpperCase(),LM,y);y+=LH+2;}
  function row(l,v){ck(LH+1);doc.setFontSize(7.5);doc.setFont('helvetica','bold');doc.setTextColor(140,140,140);doc.text(l,LM,y);doc.setFont('helvetica','normal');doc.setTextColor(25,25,25);var lines=doc.splitTextToSize(String(v||'—'),PW-52);doc.text(lines,LM+52,y);y+=Math.max(LH,lines.length*LH);}
  hdr();wm();y=46;
  sec('A — Negócio');row('Propósito',fv(f,'a_proposito'));row('Montante',fv(f,'a_montante')+' €');row('Sinal',fv(f,'a_sinal')+' €');row('Origem Fundos',getSelected('fund-opts'));row('IBAN Transferência',fv(f,'a_transf_iban'));
  if(currentType==='singular'){sec('B — Proponente Singular');row('Nome',fv(f,'c1_nome'));row('Data Nascimento',fv(f,'c1_nasc'));row('Naturalidade',fv(f,'c1_nat'));row('Nacionalidade',fv(f,'c1_nac'));row('N.º Documento',fv(f,'c1_docnum'));row('NIF',fv(f,'c1_nif'));row('Residência',fv(f,'c1_res1'));row('Profissão',fv(f,'c1_prof'));row('Telefone',fv(f,'c1_tel'));row('Email',fv(f,'c1_email'));}
  else{sec('B — Proponente Coletivo');row('Denominação Social',fv(f,'cc_denom'));row('NIPC',fv(f,'cc_nipc'));row('CAEs',fv(f,'cc_cae'));row('Objeto Social',fv(f,'cc_objeto'));row('Sede',fv(f,'cc_sede'));row('Forma Jurídica',fv(f,'cc_forma'));row('País Constituição',fv(f,'cc_pais_const'));row('RCBE',fv(f,'cc_rcbe'));}
  if(document.querySelector('.yn-btn.yes.on[onclick*="rep_det"]')){sec('Representante Legal');row('Nome',fv(f,'d_nome'));row('NIF',fv(f,'d_nif'));}
  sec('PeP — Questões');[['Questão 1','p1d','p1_int'],['Questão 2','p2d','p2_int'],['Questão 3','p3d','p3_int'],['Questão 4','p4d','p4_int']].forEach(function(q){var yn=document.querySelector('.yn-btn.yes.on[onclick*="'+q[1]+'"]');row(q[0],yn?(currentLang==='pt'?'Sim':'Yes')+(f[q[2]]?' — '+f[q[2]]:''):(currentLang==='pt'?'Não':'No'));});
  sec('Assinaturas');ck(60);y+=4;
  var sy=y,cw=(PW-10)/2;
  doc.setFontSize(7);doc.setFont('helvetica','bold');doc.setTextColor(140,140,140);doc.text('PROPONENTE 1',LM,y);y+=5;doc.setFontSize(8.5);doc.setFont('helvetica','normal');doc.setTextColor(25,25,25);doc.text('Nome: '+fv(f,'h1_nome'),LM,y);y+=5;doc.text('Data: '+fv(f,'h1_data'),LM,y);y+=6;doc.setFontSize(7);doc.setTextColor(140,140,140);doc.text('Assinatura',LM,y);y+=4;doc.setDrawColor(40,40,40);doc.setLineWidth(0.3);doc.line(LM,y,LM+cw,y);var yp1=y+4;
  y=sy;var x2=LM+cw+10;
  doc.setFontSize(7);doc.setFont('helvetica','bold');doc.setTextColor(140,140,140);doc.text('PROPONENTE 2 / REP. LEGAL',x2,y);y+=5;doc.setFontSize(8.5);doc.setFont('helvetica','normal');doc.setTextColor(25,25,25);doc.text('Nome: '+fv(f,'h2_nome'),x2,y);y+=5;doc.text('Data: '+fv(f,'h2_data'),x2,y);y+=6;doc.setFontSize(7);doc.setTextColor(140,140,140);doc.text('Assinatura',x2,y);y+=4;doc.setDrawColor(40,40,40);doc.setLineWidth(0.3);doc.line(x2,y,x2+cw,y);
  y=Math.max(yp1,y+4)+6;doc.setFontSize(7);doc.setFont('helvetica','normal');doc.setTextColor(140,140,140);doc.text('(*) Assinatura(s) conforme documento de identificação.',LM,y);
  var total=doc.getNumberOfPages();for(var p=1;p<=total;p++){doc.setPage(p);ftr();doc.setFontSize(6.5);doc.setTextColor(180,180,180);doc.text(p+' / '+total,RM,293,{align:'right'});}
  pdfDoc=doc;
}
function genRef(){var y=new Date().getFullYear();return 'ALG-'+y+'-'+String(Math.floor(Math.random()*9000)+1000);}

// ── INIT ──
(function(){
  // Referência: usar a do Model Razor se existir, senão gerar/restaurar do localStorage
  var el=document.getElementById('ref_interna');
  if(el){
    var razorRef=document.getElementById('kyc_process_ref')?document.getElementById('kyc_process_ref').value:'';
    if(razorRef && razorRef !== ''){
      el.value=razorRef;
    } else {
      var saved='';
      try{var s=localStorage.getItem('alg_kyc');if(s){var d=JSON.parse(s);saved=d['ref_interna']||'';}}catch(e){}
      el.value=saved||genRef();
    }
  }
})();

// Steps
var stepsEl=document.getElementById('steps');
for(var i=0;i<SECTIONS;i++){var dot=document.createElement('div');dot.className='sd'+(i===0?' active':'');stepsEl.appendChild(dot);}

// Init upload buttons (simples — sem checkbox)
['f1','f2','f3','f4','f5','f6','cc1','cc2','cc3','cc4','cc5'].forEach(function(k){
  var btn=document.getElementById('upbtn-'+k);
  if(btn){btn.innerHTML=UPLOAD_ICON;var inp=btn.querySelector('input[type=file]');if(inp)btn.appendChild(inp);}
});

// Campos obrigatórios base (fora de secções condicionais)
document.querySelectorAll('[data-req-pt]').forEach(function(el){
  if(!el.closest('#section-singular')&&!el.closest('#section-coletiva')&&!el.closest('#conj_det')&&!el.closest('#rep_det')&&!el.closest('#p1d')&&!el.closest('#p2d')&&!el.closest('#p3d')&&!el.closest('#p4d')){
    el.setAttribute('data-req',el.getAttribute('data-req-pt'));
  }
});

document.querySelectorAll('input,textarea,select').forEach(function(el){el.addEventListener('input',updateProgress);el.addEventListener('change',updateProgress);});
document.addEventListener('input',function(e){if(e.target.classList&&e.target.classList.contains('err-field')){e.target.classList.remove('err-field');var msg=e.target.nextElementSibling;if(msg&&msg.classList.contains('f-err'))msg.classList.remove('show');}});

// Fundos checkboxes
['g1','g2','g3','g4','g5','g6'].forEach(function(k){
  var chk=document.getElementById('ckchk-'+k);
  if(chk){chk.addEventListener('click',function(){chk.classList.toggle('on');var isOn=chk.classList.contains('on');var btn=document.getElementById('upbtn-'+k);var meta=document.getElementById('upmeta-'+k);var errEl=document.getElementById('uperr-'+k);if(btn){btn.style.display=isOn?'flex':'none';if(!isOn)btn.classList.remove('required-upload');}if(meta&&!isOn){meta.style.display='none';var fl=document.getElementById('upfiles-'+k);if(fl)fl.textContent='';docFiles[k]=null;}if(errEl)errEl.classList.remove('show');updateProgress();});}
  var inp=document.getElementById('upinput-'+k);
  if(inp){inp.addEventListener('change',function(){docFileSet(inp,k);});var btn=document.getElementById('upbtn-'+k);if(btn){btn.innerHTML=UPLOAD_ICON;btn.appendChild(inp);}}
});

// Logo PDF
(function(){
  var SVG='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 140" width="180" height="58"><rect x="168" y="4" width="224" height="30" fill="none" stroke="#111" stroke-width="2"/><text x="280" y="25" font-family="Montserrat,Arial,sans-serif" font-size="13" font-weight="400" letter-spacing="5" fill="#111" text-anchor="middle">LX PARTNERS</text><text x="280" y="82" font-family="Montserrat,Arial,sans-serif" font-size="44" font-weight="200" letter-spacing="14" fill="#111" text-anchor="middle">ALGEBRA</text><line x1="4" y1="92" x2="556" y2="92" stroke="#111" stroke-width="1.5"/><text x="280" y="128" font-family="Montserrat,Arial,sans-serif" font-size="34" font-weight="200" letter-spacing="20" fill="#111" text-anchor="middle">CAPITAL</text></svg>';
  var blob=new Blob([SVG],{type:'image/svg+xml'});var url=URL.createObjectURL(blob);var img=new Image();
  img.onload=function(){var c=document.createElement('canvas');var ratio=window.devicePixelRatio||1;var h=58,w=Math.round(img.naturalWidth*h/img.naturalHeight);c.width=w*ratio;c.height=h*ratio;var ctx=c.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,c.width,c.height);ctx.scale(ratio,ratio);ctx.drawImage(img,0,0,w,h);URL.revokeObjectURL(url);window._algLogoB64=c.toDataURL('image/png');};img.src=url;
})();

// Tipo e modo guardados
var savedType=localStorage.getItem('alg_kyc_type');
setType(savedType&&savedType!=='singular'?savedType:'singular');
if(currentType==='coletiva'&&document.getElementById('titulares-container').children.length===0)addTitular();
var savedModo=localStorage.getItem('alg_modo');if(savedModo){currentModo=savedModo;applyModo();}
loadProgress();
updateProgress();
</script>
