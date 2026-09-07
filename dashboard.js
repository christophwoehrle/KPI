/* Anwendungslogik des KW-Dashboards. DATA und Teildatensätze stammen aus den separaten Modulen. */
const colors=["#76b737","#536743","#a27a4f","#2f4b38","#8f9b80","#c18b4e","#64715b","#b6c3a8"];
const fmtNum=new Intl.NumberFormat("de-DE",{maximumFractionDigits:1});
const fmt0=new Intl.NumberFormat("de-DE",{maximumFractionDigits:0});
const fmt2=new Intl.NumberFormat("de-DE",{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtMoney=new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR",maximumFractionDigits:0});
const tooltip=document.getElementById("tooltip");
function storageGet(key){try{return localStorage.getItem(key)}catch(e){return null}}
function storageSet(key,value){try{localStorage.setItem(key,value)}catch(e){console.warn("Lokale Speicherung nicht verfügbar",e)}}
function storageRemove(key){try{localStorage.removeItem(key)}catch(e){console.warn("Lokale Speicherung nicht verfügbar",e)}}
const weekFrom=document.getElementById("weekFrom"),weekTo=document.getElementById("weekTo"),csvBtn=document.getElementById("csvBtn");
const kpis=document.getElementById("kpis"),rangeText=document.getElementById("rangeText"),latestChip=document.getElementById("latestChip");
const ytdSnapshot=document.getElementById("ytdSnapshot"),qualityMini=document.getElementById("qualityMini");
const priorityFilter=document.getElementById("priorityFilter"),areaFilter=document.getElementById("areaFilter"),issueSearch=document.getElementById("issueSearch");
const landTopSub=document.getElementById("landTopSub"),landTable=document.getElementById("landTable");

function n(v){return v===null||v===undefined||v===""?null:Number(v)}
function weekNo(s){const m=String(s||"").match(/KW\s*(\d+)/i);return m?Number(m[1]):null}
function format(v,type="number"){
  if(v===null||v===undefined||v===""||Number.isNaN(Number(v)))return "–";
  const x=Number(v);
  if(type==="currency")return fmtMoney.format(x);
  if(type==="price")return fmt2.format(x)+" €/m³";
  if(type==="pricefm")return fmt2.format(x)+" €/fm";
  if(type==="percent")return fmtNum.format(x*100)+" %";
  if(type==="pctpoint")return fmt2.format(x)+" %";
  if(type==="lfm")return fmt0.format(x)+" lfm";
  if(type==="pieces")return fmt0.format(x)+" Stück";
  if(type==="minutes")return fmt0.format(x)+" min";
  if(type==="fmmin")return fmt2.format(x)+" fm/min";
  if(type==="m3min")return fmt2.format(x)+" m³/min";
  if(type==="m3")return fmtNum.format(x)+" m³";
  if(type==="fm")return fmt0.format(x)+" fm";
  return fmtNum.format(x);
}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function selectedWeekly(){
  const a=Number(document.getElementById("weekFrom").value),b=Number(document.getElementById("weekTo").value);
  return DATA.weekly.filter(r=>r["KW Nr."]>=a&&r["KW Nr."]<=b);
}
function selectedByWeek(rows,key="KW"){
  const a=Number(document.getElementById("weekFrom").value),b=Number(document.getElementById("weekTo").value);
  return rows.filter(r=>{const w=weekNo(r[key]);return w!==null&&w>=a&&w<=b});
}
function pctDelta(a,b){return a===null||b===null||a===0?null:(b-a)/Math.abs(a)}
function deltaClass(x){return x===null?"flat":x>.0001?"up":x<-.0001?"down":"flat"}
function trendArrow(x){return x===null?"":x>.0001?"▲":x<-.0001?"▼":"→"}


const IMPORT_STORAGE_KEY="kwDashboardImportedReportsV1";
const REPORT_COUNTRIES=[
  "FRANKREICH","DEUTSCHLAND","GROSSBRITANNIEN","IRLAND","NIR","NIEDERLANDE",
  "BELGIEN","ITALIEN","SPANIEN","PORTUGAL","ÖSTERREICH","SCHWEIZ","SONSTIGE"
];
const REPORT_SALES_CATEGORIES=[
  "Hauptware Säge","NE Sägewerk","davon Bretter","davon Contreventements","davon Voliges",
  "Latten","sonstige Weiterverarbeitung","Ausschuss","Lohnschnitt","Handel SH"
];
const REPORT_PRODUCTION_CATEGORIES=["Säge","Gatter","Gesamt Fm","Gesamt m³","RHP"];
const SAWLINE_SELECTED_ROWS=[5,6,7,8,9,17,19,20,21,22,25,26];
const SAWLINE_ROW_FORMATS={
  5:{unit:"lfm",type:"lfm"},6:{unit:"Stück",type:"pieces"},7:{unit:"fm",type:"fm"},
  8:{unit:"m³",type:"m3"},9:{unit:"%",type:"pctpoint"},17:{unit:"%",type:"pctpoint"},
  19:{unit:"min",type:"minutes"},20:{unit:"min",type:"minutes"},
  21:{unit:"fm/min",type:"fmmin"},22:{unit:"m³/min",type:"m3min"},
  25:{unit:"%",type:"pctpoint"},26:{unit:"%",type:"pctpoint"}
};

function setUploadStatus(message,state=""){
  if(!document.getElementById("uploadStatus"))return;
  uploadStatus.className="upload-status"+(state?" "+state:"");
  uploadStatus.querySelector("span:last-child").textContent=message;
}
function parseReportNumber(value){
  if(value===null||value===undefined||value==="")return null;
  if(typeof value==="number")return Number.isFinite(value)?value:null;
  const source=String(value).trim();
  if(!source||source==="***"||/^-\s*€?$/.test(source))return null;
  const match=source.match(/[-+]?\d[\d.\s]*(?:,\d+)?/);
  if(!match)return null;
  let token=match[0].replace(/\s/g,"");
  if(token.includes(","))token=token.replace(/\./g,"").replace(",",".");
  else if(/\.\d{3}(?:\D|$)/.test(source))token=token.replace(/\./g,"");
  const result=Number(token);
  return Number.isFinite(result)?result:null;
}
function columnIndexFromReference(reference){
  const letters=String(reference||"").match(/[A-Z]+/i)?.[0]?.toUpperCase()||"A";
  let value=0;
  for(const char of letters)value=value*26+char.charCodeAt(0)-64;
  return value-1;
}
function normalizeZipPath(path){
  const parts=[];
  String(path).replace(/\\/g,"/").split("/").forEach(part=>{
    if(!part||part===".")return;
    if(part==="..")parts.pop();else parts.push(part);
  });
  return parts.join("/");
}
function findZipEnd(view){
  const min=Math.max(0,view.byteLength-65557);
  for(let i=view.byteLength-22;i>=min;i--){
    if(view.getUint32(i,true)===0x06054b50)return i;
  }
  throw new Error("Die Datei besitzt kein lesbares ZIP-Endverzeichnis.");
}
function indexZipEntries(arrayBuffer){
  const view=new DataView(arrayBuffer),decoder=new TextDecoder("utf-8");
  const end=findZipEnd(view);
  const entriesCount=view.getUint16(end+10,true);
  let offset=view.getUint32(end+16,true);
  const entries=new Map();
  for(let i=0;i<entriesCount;i++){
    if(view.getUint32(offset,true)!==0x02014b50)throw new Error("Ungültiges ZIP-Zentralverzeichnis.");
    const method=view.getUint16(offset+10,true);
    const compressedSize=view.getUint32(offset+20,true);
    const uncompressedSize=view.getUint32(offset+24,true);
    const nameLength=view.getUint16(offset+28,true);
    const extraLength=view.getUint16(offset+30,true);
    const commentLength=view.getUint16(offset+32,true);
    const localOffset=view.getUint32(offset+42,true);
    const name=decoder.decode(new Uint8Array(arrayBuffer,offset+46,nameLength));
    entries.set(normalizeZipPath(name),{name,method,compressedSize,uncompressedSize,localOffset});
    offset+=46+nameLength+extraLength+commentLength;
  }
  return {arrayBuffer,view,entries};
}
async function readZipEntry(zip,name){
  const normalized=normalizeZipPath(name);
  const entry=zip.entries.get(normalized);
  if(!entry)return null;
  const {view,arrayBuffer}=zip,offset=entry.localOffset;
  if(view.getUint32(offset,true)!==0x04034b50)throw new Error("Ungültiger ZIP-Dateieintrag: "+normalized);
  const nameLength=view.getUint16(offset+26,true),extraLength=view.getUint16(offset+28,true);
  const start=offset+30+nameLength+extraLength;
  const compressed=new Uint8Array(arrayBuffer,start,entry.compressedSize);
  if(entry.method===0)return compressed.slice().buffer;
  if(entry.method!==8)throw new Error("Nicht unterstützte XLSX-Kompression: "+entry.method);
  if(typeof DecompressionStream==="undefined"){
    throw new Error("Dieser Browser unterstützt die lokale XLSX-Dekompression nicht. Bitte einen aktuellen Chrome-, Edge- oder Firefox-Browser verwenden.");
  }
  const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return await new Response(stream).arrayBuffer();
}
function xmlFromBuffer(buffer){
  if(!buffer)return null;
  const xml=new TextDecoder("utf-8").decode(buffer);
  const documentXml=new DOMParser().parseFromString(xml,"application/xml");
  const error=documentXml.getElementsByTagName("parsererror")[0];
  if(error)throw new Error("Eine XML-Datei innerhalb der Excel-Datei ist beschädigt.");
  return documentXml;
}
function nodesByLocalName(root,name){return Array.from(root.getElementsByTagNameNS("*",name))}
async function readFirstWorksheet(file){
  const zip=indexZipEntries(await file.arrayBuffer());
  let sheetPath=null;
  const workbookXml=xmlFromBuffer(await readZipEntry(zip,"xl/workbook.xml"));
  const relsXml=xmlFromBuffer(await readZipEntry(zip,"xl/_rels/workbook.xml.rels"));
  if(workbookXml&&relsXml){
    const firstSheet=nodesByLocalName(workbookXml,"sheet")[0];
    const relId=firstSheet?.getAttribute("r:id")||firstSheet?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships","id");
    const rel=nodesByLocalName(relsXml,"Relationship").find(node=>node.getAttribute("Id")===relId);
    const target=rel?.getAttribute("Target");
    if(target)sheetPath=normalizeZipPath(target.startsWith("/")?target.slice(1):"xl/"+target);
  }
  if(!sheetPath){
    sheetPath=[...zip.entries.keys()].filter(name=>/^xl\/worksheets\/sheet\d+\.xml$/i.test(name)).sort()[0];
  }
  if(!sheetPath)throw new Error("In der Excel-Datei wurde kein Arbeitsblatt gefunden.");
  const sharedXml=xmlFromBuffer(await readZipEntry(zip,"xl/sharedStrings.xml"));
  const sharedStrings=sharedXml?nodesByLocalName(sharedXml,"si").map(si=>nodesByLocalName(si,"t").map(t=>t.textContent||"").join("")):[];
  const sheetXml=xmlFromBuffer(await readZipEntry(zip,sheetPath));
  const matrix=[];
  nodesByLocalName(sheetXml,"c").forEach(cell=>{
    const reference=cell.getAttribute("r")||"A1";
    const rowIndex=(Number(reference.match(/\d+/)?.[0]||1)-1);
    const colIndex=columnIndexFromReference(reference);
    const type=cell.getAttribute("t");
    let value=null;
    if(type==="inlineStr")value=nodesByLocalName(cell,"t").map(t=>t.textContent||"").join("");
    else{
      const v=nodesByLocalName(cell,"v")[0]?.textContent??"";
      if(type==="s")value=sharedStrings[Number(v)]??"";
      else if(type==="str"||type==="e")value=v;
      else if(type==="b")value=v==="1";
      else value=v===""?null:Number(v);
    }
    if(!matrix[rowIndex])matrix[rowIndex]=[];
    matrix[rowIndex][colIndex]=value;
  });
  return matrix;
}
function reportCell(matrix,row,column){return matrix[row-1]?.[column]??null}
function weeklyFileMeta(fileName,{required=true}={}){
  // Trennzeichen zwischen KW, Nummer und Jahr sind optional (KW-28-2025 / KW282025 / KW_28_2025 …).
  const match=String(fileName||"").match(/^KW[-_ ]?(\d{1,2})[-_ ]?(20\d{2})\.xlsx$/i);
  if(!match){
    if(required)throw new Error("Allgemeine Wochenberichte müssen dem Schema KW-XX-20XX.xlsx entsprechen, zum Beispiel KW-18-2026.xlsx.");
    return null;
  }
  const week=Number(match[1]),year=Number(match[2]);
  if(week<1||week>53)throw new Error(`Die Kalenderwoche ${match[1]} im Dateinamen ist ungültig.`);
  return {week,year};
}
function isWeeklyReport(matrix,fileName){
  return weeklyFileMeta(fileName,{required:false})!==null;
}
function reportWeek(matrix,fileName){
  return weeklyFileMeta(fileName).week;
}

function sawlineFileMeta(fileName,{required=true}={}){
  const match=String(fileName||"").match(/^Sh_(\d{2})_(\d{2})\.xlsx$/i);
  if(!match){
    if(required)throw new Error("Sägelinien-Dateien müssen dem Schema Sh_KW_Jahr.xlsx entsprechen, zum Beispiel Sh_02_26.xlsx.");
    return null;
  }
  const week=Number(match[1]),yearShort=Number(match[2]),year=2000+yearShort;
  if(week<1||week>53)throw new Error(`Die Kalenderwoche ${match[1]} im Dateinamen ist ungültig.`);
  return {week,yearShort,year};
}
function isSawlineReport(matrix,fileName){
  return sawlineFileMeta(fileName,{required:false})!==null;
}
function sawlineReportWeek(matrix,fileName){
  return sawlineFileMeta(fileName).week;
}
function validateSawlineReport(matrix,fileName){
  const errors=[],warnings=[];
  if(!isSawlineReport(matrix,fileName)){
    errors.push("Die Datei wurde nicht als Wochenprotokoll der Sägelinie erkannt.");
  }
  SAWLINE_SELECTED_ROWS.forEach(rowNumber=>{
    const label=String(reportCell(matrix,rowNumber,0)||"").trim();
    if(!label)errors.push(`In Zeile ${rowNumber} fehlt die Kennzahl in Spalte A.`);
    const values=[];
    for(let column=1;column<=7;column++)values.push(parseReportNumber(reportCell(matrix,rowNumber,column)));
    if(values.every(value=>value===null)){
      warnings.push(`Zeile ${rowNumber}${label?" · "+label:""} enthält in B–H keine numerischen Werte.`);
    }
  });
  return {valid:errors.length===0,errors,warnings};
}
function parseSawlineReport(matrix,fileName){
  const validation=validateSawlineReport(matrix,fileName);
  if(!validation.valid)throw new Error(validation.errors.join(" | "));
  const fileMeta=sawlineFileMeta(fileName);
  const week=fileMeta.week,year=fileMeta.year,yearShort=fileMeta.yearShort,weekLabel="KW"+String(week).padStart(2,"0");
  const title=String(reportCell(matrix,1,0)||"");
  const period=title.match(/\(([^)]+)\)/)?.[1]?.trim()||"";
  const dayKeys=["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Summe"];
  const rows=SAWLINE_SELECTED_ROWS.map(rowNumber=>{
    const config=SAWLINE_ROW_FORMATS[rowNumber];
    const record={
      "KW":weekLabel,"KW Nr.":week,"Jahr":year,"Jahr kurz":yearShort,"Zeile":rowNumber,
      "KPI":String(reportCell(matrix,rowNumber,0)||"").trim(),
      "Einheit":config.unit,"Werttyp":config.type,
      "Zeitraum":period,"Quelldatei":fileName
    };
    dayKeys.forEach((key,index)=>record[key]=parseReportNumber(reportCell(matrix,rowNumber,index+1)));
    return record;
  });
  return {kind:"sawline",week,weekLabel,year,yearShort,fileName,period,rows,warnings:validation.warnings};
}
/* Layout-tolerantes Auslesen: Abschnitte werden über ihre Beschriftungen gefunden,
   damit unterschiedliche Berichtsvorlagen (z. B. 2025 vs. 2026) korrekt eingelesen werden. */
function normRK(v){return String(v==null?"":v).replace(/\s+/g," ").trim().toLowerCase();}
function findRC(matrix,text,{fromRow=1,includes=false}={}){
  const t=normRK(text);
  for(let r=fromRow;r<=matrix.length;r++){const row=matrix[r-1]||[];
    for(let c=0;c<row.length;c++){const cell=normRK(row[c]);
      if(cell&&(includes?cell.includes(t):cell===t))return {row:r,col:c};}}
  return null;
}
function findRowByCol(matrix,col,text,{fromRow=1,includes=false}={}){
  const t=normRK(text);
  for(let r=fromRow;r<=matrix.length;r++){const cell=normRK((matrix[r-1]||[])[col]);
    if(cell&&(includes?cell.includes(t):cell===t))return r;}
  return null;
}
function findColInRow(matrix,row,text,{fromCol=0,includes=true}={}){
  if(row==null)return -1;
  const t=normRK(text);const cells=matrix[row-1]||[];
  for(let c=fromCol;c<cells.length;c++){const cell=normRK(cells[c]);
    if(cell&&(includes?cell.includes(t):cell===t))return c;}
  return -1;
}
function numAt(matrix,row,col){return (row!=null&&col!=null&&col>=0)?parseReportNumber(reportCell(matrix,row,col)):null;}
function parseWeeklyReport(matrix,fileName){
  const fileMeta=weeklyFileMeta(fileName);
  const week=fileMeta.week,year=fileMeta.year,weekLabel="KW"+String(week).padStart(2,"0");

  // ---------- Umsatzuntergliederung (Anker: "Hauptware Säge") ----------
  const hw=findRC(matrix,"Hauptware Säge");
  let salesNameCol=0,salesMengeCol=-1,salesEurCol=-1,salesMpCol=-1,salesHeaderRow=null,salesStart=1;
  if(hw){
    salesNameCol=hw.col;salesStart=hw.row;
    for(let r=hw.row-1;r>=Math.max(1,hw.row-5);r--){
      if(findColInRow(matrix,r,"eur")>=0&&findColInRow(matrix,r,"m%")>=0){salesHeaderRow=r;break;}
    }
    salesMengeCol=findColInRow(matrix,salesHeaderRow,"menge");
    salesEurCol=findColInRow(matrix,salesHeaderRow,"eur");
    salesMpCol=findColInRow(matrix,salesHeaderRow,"m%");
    if(salesMengeCol<0)salesMengeCol=salesNameCol+2;
    if(salesEurCol<0)salesEurCol=salesNameCol+3;
    if(salesMpCol<0)salesMpCol=salesNameCol+4;
  }
  const salesBreakdown=REPORT_SALES_CATEGORIES.map(category=>{
    const row=hw?findRowByCol(matrix,salesNameCol,category,{fromRow:salesStart}):null;
    return {
      "KW":weekLabel,"KW Nr.":week,"Kategorie":category,
      "Menge (m³)":numAt(matrix,row,salesMengeCol),
      "EUR (€/m³)":numAt(matrix,row,salesEurCol),
      "M%":numAt(matrix,row,salesMpCol)
    };
  });
  const gesamtRow=hw?findRowByCol(matrix,salesNameCol,"Gesamt",{fromRow:salesStart}):null;
  const umsatzMengeGesamt=numAt(matrix,gesamtRow,salesMengeCol);
  const preisGesamt=numAt(matrix,gesamtRow,salesEurCol);

  // ---------- Länder (Anker: "Land") ----------
  const landHead=findRC(matrix,"Land");
  const countryShares={},countryPrices={};
  let landCol=-1,cMpCol=-1,cHwPriceCol=-1,cGesamtPriceCol=-1;
  if(landHead){
    landCol=landHead.col;
    cMpCol=findColInRow(matrix,landHead.row,"m%",{fromCol:landCol+1,includes:false});
    if(cMpCol<0)cMpCol=findColInRow(matrix,landHead.row,"m%",{fromCol:landCol+1});
    cGesamtPriceCol=findColInRow(matrix,landHead.row,"gesamt",{fromCol:landCol+1});
    cHwPriceCol=findColInRow(matrix,landHead.row,"ø-preis hw",{fromCol:landCol+1});
  }
  const countryComparison=REPORT_COUNTRIES.map(country=>{
    const row=landHead?findRowByCol(matrix,landCol,country,{fromRow:landHead.row}):null;
    const record={
      "KW":weekLabel,"KW Nr.":week,"Jahr":year,"Land":country,
      "M%":numAt(matrix,row,cMpCol),
      "M% HW-Säge":null,"M% SW":null,
      "Ø-Preis HW-Säge":numAt(matrix,row,cHwPriceCol),
      "Ø-Preis Gesamt":numAt(matrix,row,cGesamtPriceCol),
      "Quelldatei":fileName
    };
    countryShares[country]=record["M%"];
    countryPrices[country]=record["Ø-Preis Gesamt"];
    return record;
  });

  // ---------- Veredelungen (Anker: "Veredelungen") ----------
  const verHead=findRC(matrix,"Veredelungen");
  const refinement={};
  const verTotalCol=findColInRow(matrix,verHead?verHead.row:null,"schnittholz");
  const verMainCol=findColInRow(matrix,verHead?verHead.row:null,"hauptware");
  const verSideCol=findColInRow(matrix,verHead?verHead.row:null,"ne sägewerk");
  const verRestCol=findColInRow(matrix,verHead?verHead.row:null,"rest");
  ["Trocknung","Hobelung","Imprägnierung"].forEach(name=>{
    const row=verHead?findRowByCol(matrix,verHead.col,name,{fromRow:verHead.row}):null;
    refinement[name]={
      total:numAt(matrix,row,verTotalCol),main:numAt(matrix,row,verMainCol),
      side:numAt(matrix,row,verSideCol),rest:numAt(matrix,row,verRestCol)
    };
  });

  // ---------- Leistung Produktion (Anker: "Leistung Produktion") ----------
  const prodHead=findRC(matrix,"Leistung Produktion",{includes:true});
  const prodColRow=prodHead?prodHead.row+1:null;
  const pAktCol=findColInRow(matrix,prodColRow,"aktuell");
  const pKum1Col=findColInRow(matrix,prodColRow,"kumuliert",{fromCol:pAktCol>=0?pAktCol+1:0});
  const pKum2Col=findColInRow(matrix,prodColRow,"kumuliert",{fromCol:pKum1Col>=0?pKum1Col+1:0});
  const pDiffCol=findColInRow(matrix,prodColRow,"differenz");
  const production={};
  [["Säge","säge"],["Gatter","gatter"],["Gesamt Fm","gesamt fm"],["Gesamt m³","gesamt m³"],["RHP","rhp"]].forEach(([name,key])=>{
    const row=prodHead?findRowByCol(matrix,prodHead.col,key,{fromRow:prodHead.row}):null;
    production[name]={
      current:numAt(matrix,row,pAktCol),ytd2026:numAt(matrix,row,pKum1Col),
      ytd2025:numAt(matrix,row,pKum2Col),difference:numAt(matrix,row,pDiffCol)
    };
  });
  const productionCurrent=REPORT_PRODUCTION_CATEGORIES.map(name=>({
    "KW":weekLabel,"KW Nr.":week,"Kennzahl":name,
    "Aktuell":production[name]?.current??null,"Einheit":name==="Gesamt m³"?"m³":"fm"
  }));

  // ---------- Deckungsbeitrag (Anker: "Deckungsbeitrag") ----------
  const dbHead=findRC(matrix,"Deckungsbeitrag");
  const dbNettoCol=findColInRow(matrix,dbHead?dbHead.row:null,"db netto");
  const dbEurCol=findColInRow(matrix,dbHead?dbHead.row:null,"eur");
  const dbRow=dbHead?findRowByCol(matrix,dbHead.col,"SH-Gesamt",{fromRow:dbHead.row,includes:true}):null;
  const dbNetto=numAt(matrix,dbRow,dbNettoCol),dbProM3=numAt(matrix,dbRow,dbEurCol);

  // ---------- A-Eingang (Anker: "A-Eingang") ----------
  const aeHead=findRC(matrix,"A-Eingang",{includes:true});
  const aeColRow=aeHead?aeHead.row+1:null;
  const aeTotalCol=findColInRow(matrix,aeColRow,"gesamt");
  const aeDriedCol=findColInRow(matrix,aeColRow,"getrocknet");
  const aePlanedCol=findColInRow(matrix,aeColRow,"gehobelt");
  const aeReservedCol=findColInRow(matrix,aeColRow,"reserviert");
  const aeGesamtRow=aeHead?findRowByCol(matrix,aeHead.col,"Gesamt",{fromRow:aeHead.row}):null;
  const aeFranceRow=aeHead?findRowByCol(matrix,aeHead.col,"frankreich",{fromRow:aeHead.row,includes:true}):null;
  const aeOtherRow=aeHead?findRowByCol(matrix,aeHead.col,"übrige",{fromRow:aeHead.row,includes:true}):null;
  const incoming={
    total:numAt(matrix,aeGesamtRow,aeTotalCol),dried:numAt(matrix,aeGesamtRow,aeDriedCol),
    planed:numAt(matrix,aeGesamtRow,aePlanedCol),reserved:numAt(matrix,aeGesamtRow,aeReservedCol),
    franceTotal:numAt(matrix,aeFranceRow,aeTotalCol),franceDried:numAt(matrix,aeFranceRow,aeDriedCol),
    otherTotal:numAt(matrix,aeOtherRow,aeTotalCol),otherDried:numAt(matrix,aeOtherRow,aeDriedCol)
  };

  // ---------- Auftragsbestand 4W/8W (Anker: "Auftragsbestand") ----------
  const abHead=findRC(matrix,"Auftragsbestand");
  const abG1=findColInRow(matrix,abHead?abHead.row:null,"gesamt",{fromCol:abHead?abHead.col+1:0});
  const abR1=findColInRow(matrix,abHead?abHead.row:null,"reserv",{fromCol:abG1>=0?abG1+1:0});
  const abG2=findColInRow(matrix,abHead?abHead.row:null,"gesamt",{fromCol:abR1>=0?abR1+1:0});
  const abR2=findColInRow(matrix,abHead?abHead.row:null,"reserv",{fromCol:abG2>=0?abG2+1:0});
  const backlog=[];
  if(abHead){
    for(let row=abHead.row+1;row<=abHead.row+4;row++){
      backlog.push({total:numAt(matrix,row,abG1),reserved:numAt(matrix,row,abR1)});
      backlog.push({total:numAt(matrix,row,abG2),reserved:numAt(matrix,row,abR2)});
    }
  }
  const firstFour=backlog.filter((_,index)=>index%2===0);
  const sum4=firstFour.reduce((sum,item)=>sum+(item.total||0),0);
  const sum4Reserved=firstFour.reduce((sum,item)=>sum+(item.reserved||0),0);
  const sum8=backlog.reduce((sum,item)=>sum+(item.total||0),0);
  const sum8Reserved=backlog.reduce((sum,item)=>sum+(item.reserved||0),0);

  // ---------- 4-Wochenfenster (+/-, Reserv.%, Lagerbestand) ----------
  const wfHead=findRC(matrix,"4-Wochenfenster");
  const pmRow=wfHead?findRowByCol(matrix,wfHead.col,"+/-",{fromRow:wfHead.row,includes:true}):null;
  const windowPlusMinus=numAt(matrix,pmRow,wfHead?wfHead.col+1:-1);
  let reported4=numAt(matrix,pmRow,wfHead?wfHead.col+2:-1);
  const reservCol=findColInRow(matrix,wfHead?wfHead.row:null,"reserv");
  const lagerCol=findColInRow(matrix,wfHead?wfHead.row:null,"lagerbestand");
  const reservationPct=numAt(matrix,pmRow,reservCol);
  const lagerbestand=numAt(matrix,pmRow,lagerCol);
  if(reported4===null)reported4=sum4||null;

  // ---------- Auftragsbestand Trocknung ----------
  const dtHead=findRC(matrix,"Auftragsbestand Trocknung",{includes:true});
  const drying=[];
  if(dtHead){
    for(let row=dtHead.row+1;row<=dtHead.row+3;row++){
      drying.push({
        target:String(reportCell(matrix,row,dtHead.col)||"").replace(/tr /i,"").replace(/\s/g,""),
        value1:numAt(matrix,row,dtHead.col+1),value2:null
      });
    }
  }

  // ---------- Anzahl der Verladungen ----------
  const shHead=findRC(matrix,"Anzahl der Verladungen",{includes:true});
  const shDayCol=shHead?shHead.col:-1,shValCol=shHead?shHead.col+1:-1;
  const weekdays=["Montag","Dienstag","Mittwoch","Donnerstag","Freitag"];
  const shipmentDays={};
  weekdays.forEach(day=>{
    const row=shHead?findRowByCol(matrix,shDayCol,day,{fromRow:shHead.row}):null;
    shipmentDays[day]=numAt(matrix,row,shValCol);
  });
  const shGesamtRow=shHead?findRowByCol(matrix,shDayCol,"Gesamt",{fromRow:shHead.row}):null;
  const shipmentTotal=numAt(matrix,shGesamtRow,shValCol);
  const shipmentAverage=numAt(matrix,shGesamtRow,shValCol+1);

  const P=name=>production[name]||{current:null,ytd2026:null,ytd2025:null,difference:null};
  const weekly={
    "KW":weekLabel,"KW Nr.":week,
    "Umsatzmenge gesamt (m³)":umsatzMengeGesamt,
    "Ø Preis gesamt (€/m³)":preisGesamt,
    "DB Netto (€)":dbNetto,
    "DB (€/m³)":dbProM3,
    "Produktion KW gesamt (fm)":P("Gesamt Fm").current,
    "Produktion YTD 2026 (fm)":P("Gesamt Fm").ytd2026,
    "Produktion YTD 2025 (fm)":P("Gesamt Fm").ytd2025,
    "YTD Differenz (fm)":P("Gesamt Fm").difference,
    "Auftragseingang gesamt (m³)":incoming.total,
    "Auftragsbestand 4W (m³)":reported4,
    "Auftragsbestand 8W gesamt (m³)":sum8,
    "Auftragsbestand 8W inkl. Reserv. (m³)":sum8Reserved,
    "Lagerbestand (m³)":lagerbestand,
    "Reservierungsquote":reservationPct===null?null:reservationPct/100,
    "Verladungen gesamt":shipmentTotal,
    "Verladungen Ø/Tag":shipmentAverage,
    "Produktion KW (m³)":P("Gesamt m³").current,
    "Produktion YTD 2026 (m³)":P("Gesamt m³").ytd2026,
    "Produktion YTD 2025 (m³)":P("Gesamt m³").ytd2025,
    "YTD Differenz (m³)":P("Gesamt m³").difference,
    "RHP KW (fm)":P("RHP").current,
    "RHP YTD 2026 (fm)":P("RHP").ytd2026,
    "RHP YTD 2025 (fm)":P("RHP").ytd2025,
    "RHP YTD Differenz (fm)":P("RHP").difference,
    "Trocknung (m³)":refinement.Trocknung?.total??null,
    "Hobelung (m³)":refinement.Hobelung?.total??null,
    "Imprägnierung (m³)":refinement.Imprägnierung?.total??null,
    "A-Eingang getrocknet (m³)":incoming.dried,
    "A-Eingang gehobelt (m³)":incoming.planed,
    "A-Eingang reserviert (m³)":incoming.reserved,
    "4-Wochenfenster +/- (m³)":windowPlusMinus,
    "Quelldatei":fileName,
    "Preisindex (KW18=100)":null,"DB-Index (KW18=100)":null
  };
  const ytd={
    "KW":weekLabel,
    "Produktion fm 2026":P("Gesamt Fm").ytd2026,
    "Produktion fm 2025":P("Gesamt Fm").ytd2025,
    "Diff. fm":P("Gesamt Fm").difference,
    "Diff. %":P("Gesamt Fm").ytd2025?(P("Gesamt Fm").ytd2026-P("Gesamt Fm").ytd2025)/P("Gesamt Fm").ytd2025:null,
    "Produktion m³ 2026":P("Gesamt m³").ytd2026,
    "Produktion m³ 2025":P("Gesamt m³").ytd2025,
    "Diff. m³":P("Gesamt m³").difference,
    "Diff. % ":P("Gesamt m³").ytd2025?(P("Gesamt m³").ytd2026-P("Gesamt m³").ytd2025)/P("Gesamt m³").ytd2025:null,
    "RHP fm 2026":P("RHP").ytd2026,
    "RHP fm 2025":P("RHP").ytd2025,
    "Diff. fm ":P("RHP").difference,
    "Diff. %  ":P("RHP").ytd2025?(P("RHP").ytd2026-P("RHP").ytd2025)/P("RHP").ytd2025:null
  };
  const orderWindow={
    "KW":weekLabel,"4W berechnet":sum4,"4W gemeldet":reported4,
    "Abweichung":reported4===null?null:reported4-sum4,
    "4W mit Reserv.":sum4Reserved,"Reserv.% gem.":reservationPct,
    "Reserv.% gerechnet":sum4?((sum4Reserved-sum4)/sum4*100):null,
    "Quote-Abw.":null,"8W Gesamt":sum8,"8W mit Reserv.":sum8Reserved,
    "+/- gemeldet":weekly["4-Wochenfenster +/- (m³)"],"+/- ggü. Vorwoche":null,
    "Abweichung +/-":null,"Lagerbestand":weekly["Lagerbestand (m³)"],
    "Status 4W":"OK","Status +/-":"OK","Quelldatei":fileName,"Hinweis":""
  };
  const dryingRow={
    "Berichts-KW":weekLabel,
    "Ziel-KW 1":drying[0]?.target||null,"Wert 1":drying[0]?.value1??null,"Zusatzwert 1":drying[0]?.value2??null,
    "Ziel-KW 2":drying[1]?.target||null,"Wert 2":drying[1]?.value1??null,"Zusatzwert 2":drying[1]?.value2??null,
    "Ziel-KW 3":drying[2]?.target||null,"Wert 3":drying[2]?.value1??null,"Zusatzwert 3":drying[2]?.value2??null,
    "Summe Hauptspalte":drying.reduce((sum,item)=>sum+(item.value1||0),0),
    "Prüfhinweis":""
  };
  const activeDays=Object.values(shipmentDays).filter(value=>value>0).length;
  const shipmentRow={
    "KW":weekLabel,"Mo":shipmentDays.Montag,"Di":shipmentDays.Dienstag,"Mi":shipmentDays.Mittwoch,
    "Do":shipmentDays.Donnerstag,"Fr":shipmentDays.Freitag,
    "Summe Tage":Object.values(shipmentDays).reduce((sum,value)=>sum+(value||0),0),
    "Gesamt gemeldet":shipmentTotal,"Abweichung":null,"aktive Tage":activeDays,
    "Ø gerechnet":shipmentTotal!==null&&activeDays?Math.round(shipmentTotal/activeDays):null,
    "Ø gemeldet":shipmentAverage
  };
  return {kind:"weekly",week,weekLabel,year,fileName,weekly,ytd,salesBreakdown,productionCurrent,countryShares,countryPrices,countryComparison,refinement,production,incoming,backlog,orderWindow,drying:dryingRow,shipments:shipmentRow};
}
function makeIssue(bundle,area,priority,check,reported,expected,note){
  return {
    "KW":bundle.weekLabel,"Bereich":area,"Priorität":priority,"Prüffall":check,
    "Gemeldet":reported,"Rechnerisch/erwartet":expected,
    "Abweichung":reported===null||reported===undefined||expected===null||expected===undefined?null:reported-expected,
    "Erläuterung":note,"Quelldatei":bundle.fileName
  };
}
function validateImportedReport(bundle,previousWeekly){
  const issues=[],tolerance=.01;
  const add=(...args)=>issues.push(makeIssue(bundle,...args));
  const countryTotal=REPORT_COUNTRIES.filter(c=>c!=="NIR").reduce((sum,c)=>sum+(bundle.countryShares[c]||0),0);
  if(Math.abs(countryTotal-100)>.11)add("Land","Mittel","Summe Länderanteile ohne NIR",countryTotal,100,"Die Länderanteile ohne die Teilmenge NIR sollten rund 100 % ergeben.");
  Object.entries(bundle.refinement).forEach(([name,d])=>{
    const expected=(d.main||0)+(d.side||0)+(d.rest||0);
    if(d.total!==null&&Math.abs(d.total-expected)>tolerance)add("Veredelung","Mittel",name+": Komponenten gegen Gesamt",d.total,expected,"Hauptware, NE Sägewerk und Rest ergeben nicht den gemeldeten Gesamtwert.");
  });
  Object.entries(bundle.production).forEach(([name,d])=>{
    const expected=d.ytd2026!==null&&d.ytd2025!==null?d.ytd2026-d.ytd2025:null;
    if(d.difference!==null&&expected!==null&&Math.abs(d.difference-expected)>tolerance)add("Leistung Produktion","Niedrig",name+": Differenz 2026–2025",d.difference,expected,"Die gemeldete YTD-Differenz stimmt nicht exakt mit 2026 minus 2025 überein.");
  });
  const saw=bundle.production.Säge.current,gatter=bundle.production.Gatter.current,total=bundle.production["Gesamt Fm"].current;
  if(total!==null&&saw!==null&&gatter!==null&&Math.abs(total-saw-gatter)>tolerance)add("Leistung Produktion","Hoch","Säge + Gatter = Gesamt Fm",total,saw+gatter,"Die aktuelle Gesamtproduktion entspricht nicht der Summe aus Säge und Gatter.");
  if(previousWeekly){
    const checks=[
      ["Gesamt Fm","Produktion YTD 2026 (fm)","Produktion KW gesamt (fm)"],
      ["Gesamt m³","Produktion YTD 2026 (m³)","Produktion KW (m³)"],
      ["RHP","RHP YTD 2026 (fm)","RHP KW (fm)"]
    ];
    checks.forEach(([name,ytdKey,currentKey])=>{
      const previous=n(previousWeekly[ytdKey]),current=bundle.production[name].ytd2026,reported=bundle.production[name].current;
      const expected=previous!==null&&current!==null?current-previous:null;
      if(reported!==null&&expected!==null&&Math.abs(reported-expected)>tolerance)add("Leistung Produktion","Hoch",name+": kumulierte Fortschreibung",reported,expected,"Aktueller Wochenwert entspricht nicht dem Zuwachs des kumulierten 2026-Werts gegenüber der Vorwoche.");
    });
  }
  const ae=bundle.incoming;
  if(ae.total!==null&&Math.abs(ae.total-(ae.franceTotal||0)-(ae.otherTotal||0))>tolerance)add("A-Eingang","Mittel","Gesamt = Frankreich + übrige Länder",ae.total,(ae.franceTotal||0)+(ae.otherTotal||0),"Die regionale Summe stimmt nicht mit dem A-Eingang Gesamt überein.");
  if(ae.dried!==null&&Math.abs(ae.dried-(ae.franceDried||0)-(ae.otherDried||0))>tolerance)add("A-Eingang","Mittel","Getrocknet = Frankreich + übrige Länder",ae.dried,(ae.franceDried||0)+(ae.otherDried||0),"Die regionalen getrockneten Mengen stimmen nicht mit dem Gesamtwert überein.");
  if(bundle.orderWindow["4W gemeldet"]!==null&&Math.abs(bundle.orderWindow["4W gemeldet"]-bundle.orderWindow["4W berechnet"])>tolerance)add("Auftragsbestand","Mittel","4-Wochen-Gesamt",bundle.orderWindow["4W gemeldet"],bundle.orderWindow["4W berechnet"],"Die vier Einzelwochen ergeben einen anderen Wert als der gemeldete 4-Wochenbestand.");
  const quoteExpected=bundle.orderWindow["Reserv.% gerechnet"],quoteReported=bundle.orderWindow["Reserv.% gem."];
  if(quoteExpected!==null&&quoteReported!==null&&Math.abs(quoteExpected-quoteReported)>.011)add("4-Wochenfenster","Mittel","Reservierungsquote",quoteReported,quoteExpected,"Die Quote entspricht nicht dem Reservierungsaufschlag des 4-Wochenbestands.");
  if(bundle.weekly["Lagerbestand (m³)"]===null)add("4-Wochenfenster","Mittel","Lagerbestand fehlt",null,null,"Im Wochenbericht ist kein Lagerbestand eingetragen.");
  if([bundle.drying["Zusatzwert 1"],bundle.drying["Zusatzwert 2"],bundle.drying["Zusatzwert 3"]].some(v=>v!==null))add("Auftragsbestand Trocknung","Hoch","Zusätzliche Wertespalte",null,null,"Im Trocknungsbereich wurden Werte in einer zusätzlichen, nicht eindeutig beschrifteten Spalte gefunden.");
  if(bundle.shipments["Gesamt gemeldet"]!==null&&Math.abs(bundle.shipments["Gesamt gemeldet"]-bundle.shipments["Summe Tage"])>tolerance)add("Anzahl Verladungen","Mittel","Summe Wochentage = Gesamt",bundle.shipments["Gesamt gemeldet"],bundle.shipments["Summe Tage"],"Die Tagessumme weicht vom gemeldeten Wochenwert ab.");
  if(bundle.shipments["Ø gemeldet"]!==null&&bundle.shipments["Ø gerechnet"]!==null&&Math.abs(bundle.shipments["Ø gemeldet"]-bundle.shipments["Ø gerechnet"])>tolerance)add("Anzahl Verladungen","Niedrig","Durchschnitt je aktivem Tag",bundle.shipments["Ø gemeldet"],bundle.shipments["Ø gerechnet"],"Der gerundete Durchschnitt entspricht nicht Gesamt geteilt durch aktive Verladetage.");
  return issues;
}
function upsertByWeek(array,row,key="KW"){
  const week=weekNo(row[key]);
  const index=array.findIndex(item=>weekNo(item[key])===week);
  if(index>=0)array[index]=row;else array.push(row);
  array.sort((a,b)=>(weekNo(a[key])||0)-(weekNo(b[key])||0));
}
function setCountryWeek(rows,countryValues,weekLabel){
  REPORT_COUNTRIES.forEach(country=>{
    const label=country==="NIR"?"NIR (Teilmenge GB)":country;
    let row=rows.find(item=>String(item.Land||"").startsWith(country==="NIR"?"NIR":country));
    if(!row){row={Land:label};rows.push(row)}
    row[weekLabel]=countryValues[country];
  });
}
function recomputeImportedDerived(){
  DATA.weekly.sort((a,b)=>a["KW Nr."]-b["KW Nr."]);
  const basePrice=n(DATA.weekly[0]?.["Ø Preis gesamt (€/m³)"]);
  const baseDb=n(DATA.weekly[0]?.["DB (€/m³)"]);
  DATA.weekly.forEach(row=>{
    row["Preisindex (KW18=100)"]=basePrice&&n(row["Ø Preis gesamt (€/m³)"])!==null?n(row["Ø Preis gesamt (€/m³)"])/basePrice*100:null;
    row["DB-Index (KW18=100)"]=baseDb&&n(row["DB (€/m³)"])!==null?n(row["DB (€/m³)"])/baseDb*100:null;
  });
  DATA.orderWindow.sort((a,b)=>(weekNo(a.KW)||0)-(weekNo(b.KW)||0));
  DATA.orderWindow.forEach((row,index)=>{
    const previous=index>0?DATA.orderWindow[index-1]:null;
    row["Quote-Abw."]=row["Reserv.% gem."]===null||row["Reserv.% gerechnet"]===null?null:row["Reserv.% gem."]-row["Reserv.% gerechnet"];
    row["+/- ggü. Vorwoche"]=previous?n(row["4W berechnet"])-n(previous["4W berechnet"]):null;
    row["Abweichung +/-"]=row["+/- gemeldet"]===null||row["+/- ggü. Vorwoche"]===null?null:n(row["+/- gemeldet"])-n(row["+/- ggü. Vorwoche"]);
    row["Status 4W"]=Math.abs(n(row.Abweichung)||0)<=.01?"OK":"Prüfen";
    row["Status +/-"]=row["Abweichung +/-"]===null||Math.abs(row["Abweichung +/-"])<=.01?"OK":"Prüfen";
  });
}
function refreshAreaSummary(){
  DATA.areaSummary.forEach(area=>{
    const count=DATA.issues.filter(issue=>issue.Bereich===area.Bereich).length;
    area.Befunde=count;
    area.Status=count?"Auffällig":"Bestanden";
    if(count)area.Prüfergebnis=`${count} dokumentierte Prüffälle in den aktuell geladenen Wochen.`;
  });
}

/* Entfernt ALLE hochgeladenen Dateien (Wochenberichte und Sägelinien-Protokolle, alle Jahre)
   endgültig aus dem System – Speicher und In-Memory-Stände – und lädt den Ursprungsstand neu.
   Verhindert Doppelungen bei erneutem Hochladen. */
function countStoredUploads(){
  try{return Object.keys(JSON.parse(storageGet(IMPORT_STORAGE_KEY)||"{}")).length;}catch(e){return 0;}
}
function deleteAllUploads(){
  const count=countStoredUploads();
  const msg=count
    ? `Alle hochgeladenen Dateien (Wochenberichte und Sägelinien-Protokolle, alle Jahre) – ${count} gespeicherte${count===1?"r Import":" Importe"} – endgültig aus dem System löschen? Das Dashboard wird auf den Ursprungsstand zurückgesetzt.`
    : "Es sind keine hochgeladenen Dateien gespeichert. Das Dashboard trotzdem auf den Ursprungsstand zurücksetzen?";
  if(!confirm(msg))return;
  storageRemove(IMPORT_STORAGE_KEY);
  storageRemove(PURCHASING_STORAGE_KEY);   // hochgeladene Einkaufsdaten verwerfen, Stammdatensatz bleibt
  // In-Memory-Stände der Historie zurücksetzen (werden beim Neuladen frisch aus den Seed-Daten gebildet)
  DATA.weeklyHistory=null;DATA.salesHistory=null;
  historyResetDatasets();
  location.reload();
}
function persistImportedBundle(bundle){
  const stored=JSON.parse(storageGet(IMPORT_STORAGE_KEY)||"{}");
  const kind=bundle.kind||"weekly";
  const periodKey=`${bundle.year||2026}:${String(bundle.week).padStart(2,"0")}`;
  stored[`${kind}:${periodKey}`]=bundle;
  storageSet(IMPORT_STORAGE_KEY,JSON.stringify(stored));
}
/* Mehrere Importe in EINEM Schreibvorgang speichern; bei vollem Speicher so viele wie
   möglich behalten und dies zurückmelden (statt still zu scheitern). */
function persistImportedBundlesBatch(bundles){
  if(!bundles||!bundles.length)return {ok:true,saved:0,quotaHit:false};
  let stored={};
  try{stored=JSON.parse(storageGet(IMPORT_STORAGE_KEY)||"{}");}catch(e){stored={};}
  let saved=0,quotaHit=false,lastGood=null;
  try{lastGood=JSON.stringify(stored);}catch(e){lastGood="{}";}
  for(const bundle of bundles){
    const kind=bundle.kind||"weekly";
    const periodKey=`${bundle.year||2026}:${String(bundle.week).padStart(2,"0")}`;
    stored[`${kind}:${periodKey}`]=bundle;
    let serialized;
    try{serialized=JSON.stringify(stored);}catch(e){quotaHit=true;break;}
    try{localStorage.setItem(IMPORT_STORAGE_KEY,serialized);lastGood=serialized;saved++;}
    catch(e){quotaHit=true;break;}
  }
  if(quotaHit&&lastGood!==null){try{localStorage.setItem(IMPORT_STORAGE_KEY,lastGood);}catch(e){}}
  return {ok:!quotaHit,saved,quotaHit};
}
function mergeSawlineBundle(bundle,{persist=false}={}){
  DATA.sawlineReports=DATA.sawlineReports.filter(row=>!(row["KW Nr."]===bundle.week&&Number(row.Jahr||2026)===bundle.year));
  DATA.sawlineReports.push(...bundle.rows);
  DATA.sawlineReports.sort((a,b)=>Number(a.Jahr||0)-Number(b.Jahr||0)||a["KW Nr."]-b["KW Nr."]||a.Zeile-b.Zeile);
  if(persist)persistImportedBundle(bundle);
}
function mergeAnyImportedBundle(bundle,{persist=false}={}){
  if((bundle.kind||"weekly")==="sawline")mergeSawlineBundle(bundle,{persist});
  else mergeImportedBundle(bundle,{persist});
}

/* Baut die (einjährigen) Arbeits-Arrays für EINEN Bericht auf. Wird beim Projizieren
   des aktiven Jahres je Bericht in der KW-Reihenfolge aufgerufen. */
function applyBundleToWorking(bundle){
  const previousWeekly=DATA.weekly.filter(row=>row["KW Nr."]<bundle.week).sort((a,b)=>b["KW Nr."]-a["KW Nr."])[0]||null;
  DATA.weekly=DATA.weekly.filter(row=>row["KW Nr."]!==bundle.week);
  DATA.weekly.push(bundle.weekly);
  if(Array.isArray(bundle.salesBreakdown)){
    DATA.salesBreakdown=DATA.salesBreakdown.filter(row=>row["KW Nr."]!==bundle.week);
    DATA.salesBreakdown.push(...bundle.salesBreakdown);
    DATA.salesBreakdown.sort((a,b)=>a["KW Nr."]-b["KW Nr."]);
  }
  if(Array.isArray(bundle.productionCurrent)){
    DATA.productionCurrent=DATA.productionCurrent.filter(row=>row["KW Nr."]!==bundle.week);
    DATA.productionCurrent.push(...bundle.productionCurrent);
    DATA.productionCurrent.sort((a,b)=>a["KW Nr."]-b["KW Nr."]);
  }
  upsertByWeek(DATA.ytd,bundle.ytd);
  upsertByWeek(DATA.orderWindow,bundle.orderWindow);
  upsertByWeek(DATA.drying,bundle.drying,"Berichts-KW");
  upsertByWeek(DATA.shipments,bundle.shipments);
  setCountryWeek(DATA.landShares,bundle.countryShares,bundle.weekLabel);
  setCountryWeek(DATA.landPrices,bundle.countryPrices,bundle.weekLabel);
  if(Array.isArray(bundle.countryComparison)){
    DATA.countryComparison=(DATA.countryComparison||[]).filter(row=>row["KW Nr."]!==bundle.week);
    DATA.countryComparison.push(...bundle.countryComparison);
    DATA.countryComparison.sort((a,b)=>a["KW Nr."]-b["KW Nr."]||String(a.Land).localeCompare(String(b.Land),"de"));
  }
  DATA.issues=DATA.issues.filter(issue=>{
    const source=String(issue.Quelldatei||"");
    return issue.KW!==bundle.weekLabel&&!source.includes(`KW-${String(bundle.week).padStart(2,"0")}-${bundle.year||2026}`);
  });
  DATA.issues.push(...validateImportedReport(bundle,previousWeekly));
  recomputeImportedDerived();
  const importedOrder=DATA.orderWindow.find(row=>weekNo(row.KW)===bundle.week);
  if(importedOrder&&importedOrder["Abweichung +/-"]!==null&&Math.abs(importedOrder["Abweichung +/-"])>.01){
    DATA.issues.push(makeIssue(bundle,"4-Wochenfenster","Mittel","+/- zur Vorwoche",importedOrder["+/- gemeldet"],importedOrder["+/- ggü. Vorwoche"],"Der gemeldete +/- Wert weicht von der Veränderung des berechneten 4-Wochenbestands ab."));
  }
  refreshAreaSummary();
}
/* Nimmt einen Bericht in die Mehrjahres-Speicher auf (ohne die Arbeits-Arrays zu bauen). */
function recordImportedBundle(bundle){
  historyRecordBundle(bundle);                                  // Historie (weekly/sales)
  DATA.countryHistory=(DATA.countryHistory||[]).filter(r=>!(r["KW Nr."]===bundle.week&&Number(r.Jahr||bundle.year)===Number(bundle.year)));
  if(Array.isArray(bundle.countryComparison))DATA.countryHistory.push(...bundle.countryComparison);
  DATA._weeklyBundles=(DATA._weeklyBundles||[]).filter(b=>!(b.week===bundle.week&&Number(b.year)===Number(bundle.year)));
  DATA._weeklyBundles.push(bundle);
}
/* Stellt alle Fenster auf EIN Jahr um: Arbeits-Arrays aus den Berichten dieses Jahres neu aufbauen. */
function projectDashboardYear(year){
  const y=Number(year);
  DATA.weekly=[];DATA.salesBreakdown=[];DATA.productionCurrent=[];DATA.ytd=[];
  DATA.orderWindow=[];DATA.drying=[];DATA.shipments=[];DATA.countryComparison=[];DATA.issues=[];DATA.landShares=[];DATA.landPrices=[];
  (DATA._weeklyBundles||[]).filter(b=>Number(b.year)===y).sort((a,b)=>a.week-b.week).forEach(applyBundleToWorking);
  DATA.purchasing=(DATA.purchasingHistory||[]).filter(row=>Number(row.year)===y).sort((a,b)=>a.week-b.week);
  dashboardDisplayYear=y;
}
function projectActiveOrLatestYear(){
  const years=dashboardYears();
  if(!years.length){projectDashboardYear(historyDashboardYear());return;}
  const y=(dashboardDisplayYear!=null&&years.includes(dashboardDisplayYear))?dashboardDisplayYear:years[years.length-1];
  projectDashboardYear(y);
}
function mergeImportedBundle(bundle,{persist=false}={}){
  recordImportedBundle(bundle);
  if(persist)persistImportedBundle(bundle);
}
function applyStoredImports(){
  try{
    const stored=JSON.parse(storageGet(IMPORT_STORAGE_KEY)||"{}");
    const bundles=Object.values(stored).filter(Boolean).sort((a,b)=>(a.year||2026)-(b.year||2026)||(a.week||0)-(b.week||0));
    let ok=0;const failed=[];
    bundles.forEach(bundle=>{
      try{mergeAnyImportedBundle(bundle,{persist:false});ok++;}
      catch(error){failed.push(`${bundle.weekLabel||"KW?"}/${bundle.year||"?"}`);console.warn("Import konnte nicht angewandt werden",bundle&&bundle.fileName,error);}
    });
    projectActiveOrLatestYear();   // Arbeits-Arrays aus dem (aktiven/neuesten) Jahr aufbauen
    if(ok||failed.length)setTimeout(()=>setUploadStatus(
      failed.length?`${ok} gespeicherte Importe geladen; ${failed.length} fehlerhaft (${failed.join(", ")}).`:`${ok} gespeicherte Excel-Importe wurden geladen.`,
      failed.length?"error":"success"),0);
  }catch(error){
    console.warn("Gespeicherte Importe konnten nicht geladen werden",error);
  }
}
function rebuildWeekSelectors(selectLatest=true){
  const weeks=DATA.weekly.map(row=>row["KW Nr."]).sort((a,b)=>a-b);
  populateGlobalWeekScroller(selectLatest?Math.max(...weeks):Number(displayWeek?.value));
  const sync=(element,preferred)=>{
    if(!element)return;
    const value=preferred??Number(element.value);
    element.innerHTML=weeks.map(w=>`<option value="${w}">KW${w}</option>`).join("");
    element.value=weeks.includes(value)?value:(selectLatest?Math.max(...weeks):Math.min(...weeks));
  };
  sync(weekFrom,Number(weekFrom.value)||Math.min(...weeks));
  sync(weekTo,selectLatest?Math.max(...weeks):Number(weekTo.value));
  sync(ytdWeek,selectLatest?Math.max(...weeks):Number(ytdWeek.value));
  sync(refinementWeek,selectLatest?Math.max(...weeks):Number(refinementWeek.value));
  sync(salesWeek,selectLatest?Math.max(...weeks):Number(salesWeek.value));
  sync(productionWeek,selectLatest?Math.max(...weeks):Number(productionWeek.value));
  sync(countryCompareWeek,selectLatest?Math.max(...weeks):Number(countryCompareWeek.value));
  if(typeof worldMapWeek!=="undefined")sync(worldMapWeek,selectLatest?Math.max(...weeks):Number(worldMapWeek.value));
  if(typeof cpWeek!=="undefined")sync(cpWeek,selectLatest?Math.max(...weeks):Number(cpWeek.value));
  sync(statisticsBuilderWeek,selectLatest?Math.max(...weeks):Number(statisticsBuilderWeek.value));
  refreshBuilderWeekOptions(selectLatest?Math.max(...availableAllKpiWeeks()):Number(builderWeek.value));
  refreshStatisticsAfterDataChange();
  if(document.getElementById("builderGroup")){
    const currentGroup=builderGroup.value;
    const groups=catalogGroups();
    builderGroup.innerHTML=groups.map(group=>`<option value="${esc(group)}">${esc(group)}</option>`).join("");
    builderGroup.value=groups.includes(currentGroup)?currentGroup:(groups[0]||"");
    refreshBuilderMetricOptions();
  }
}
const SHAREPOINT_LAST_URL_KEY="kwDashboardLastSharePointUrl";
const DEFAULT_SHAREPOINT_URL="https://saegewerkstreit365.sharepoint.com/:f:/s/KIbeiStreit/IgBaVS0PZ69WQIK04ED7J7tsASPGxrG0BT0i_eNu-pPlYY4?e=BqyZqY";

function setSharePointMessage(message,state=""){
  if(!document.getElementById("sharepointMessage"))return;
  sharepointMessage.className="sp-message"+(state?" "+state:"");
  sharepointMessage.textContent=message;
}
function validateSharePointUrl(raw){
  const value=String(raw||"").trim();
  if(!value)throw new Error("Bitte einen SharePoint-Dateilink eingeben.");
  let url;
  try{url=new URL(value)}catch(e){throw new Error("Der eingegebene Link ist keine gültige URL.")}
  if(!["https:","http:"].includes(url.protocol))throw new Error("Es werden nur HTTP- oder HTTPS-Links unterstützt.");
  return url;
}
function sharePointDownloadCandidates(raw){
  const original=validateSharePointUrl(raw);
  const candidates=[original.toString()];
  if(!sharepointAutoDownload?.checked)return candidates;
  const add=url=>{const value=url.toString();if(!candidates.includes(value))candidates.push(value)};
  const withDownload=new URL(original);
  withDownload.searchParams.set("download","1");
  withDownload.searchParams.delete("web");
  add(withDownload);
  const withDownloadTrue=new URL(original);
  withDownloadTrue.searchParams.set("download","true");
  withDownloadTrue.searchParams.delete("web");
  add(withDownloadTrue);
  if(/\/_layouts\/15\/Doc\.aspx/i.test(original.pathname)&&original.searchParams.get("sourcedoc")){
    const download=new URL("/_layouts/15/download.aspx",original.origin);
    download.searchParams.set("SourceUrl",original.searchParams.get("sourcedoc"));
    add(download);
  }
  return candidates;
}
function filenameFromResponse(response,url){
  const disposition=response.headers.get("content-disposition")||"";
  const utf=disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if(utf){try{return decodeURIComponent(utf[1].replace(/["']/g,""))}catch(e){}}
  const plain=disposition.match(/filename="?([^";]+)"?/i);
  if(plain)return plain[1].trim();
  try{
    const path=decodeURIComponent(new URL(response.url||url).pathname);
    const candidate=path.split("/").filter(Boolean).pop();
    if(candidate&&/\.(xlsx|xlsm)$/i.test(candidate))return candidate;
  }catch(e){}
  return "SharePoint-Wochenbericht.xlsx";
}
async function fetchSharePointFile(rawUrl){
  const candidates=sharePointDownloadCandidates(rawUrl);
  const failures=[];
  for(const candidate of candidates){
    try{
      const response=await fetch(candidate,{
        method:"GET",credentials:"include",redirect:"follow",cache:"no-store",
        headers:{"Accept":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/octet-stream,*/*"}
      });
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const contentType=(response.headers.get("content-type")||"").toLowerCase();
      const blob=await response.blob();
      if(!blob.size)throw new Error("Die zurückgegebene Datei ist leer.");
      const head=new TextDecoder("utf-8").decode(new Uint8Array(await blob.slice(0,120).arrayBuffer())).toLowerCase();
      if(contentType.includes("text/html")||head.includes("<!doctype html")||head.includes("<html")){
        throw new Error("SharePoint hat eine Anmelde- oder Vorschauseite statt der Excel-Datei geliefert.");
      }
      const fileName=filenameFromResponse(response,candidate);
      const finalName=/\.(xlsx|xlsm)$/i.test(fileName)?fileName:fileName+".xlsx";
      return new File([blob],finalName,{type:blob.type||"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
    }catch(error){
      failures.push(error.message||String(error));
    }
  }
  throw new Error(
    "Der direkte SharePoint-Abruf wurde blockiert oder erforderte eine erneute Anmeldung. "+
    "Details: "+[...new Set(failures)].join(" | ")
  );
}
async function importFromSharePoint(){
  const raw=sharepointUrl.value.trim();
  try{
    validateSharePointUrl(raw);
    setSharePointMessage("SharePoint-Datei wird abgerufen und lokal geprüft …","working");
    setUploadStatus("SharePoint-Datei wird abgerufen …","working");
    if(sharepointRemember.checked)storageSet(SHAREPOINT_LAST_URL_KEY,raw);
    const file=await fetchSharePointFile(raw);
    await importExcelFiles([file],{source:"SharePoint",expectedKind:"auto",preserveStatus:true});
    setSharePointMessage(`${file.name} wurde erfolgreich aus SharePoint importiert.`,"success");
  }catch(error){
    setSharePointMessage(error.message,"error");
    setUploadStatus("SharePoint-Import nicht möglich. Nutze den lokalen Upload-Fallback.","error");
    console.error(error);
  }
}

async function importExcelFiles(fileList,options={}){
  const source=options.source||"lokaler Upload";
  const expectedKind=options.expectedKind||"auto";
  const files=Array.from(fileList||[]).filter(file=>/\.xlsx$/i.test(file.name));
  if(!files.length){
    setUploadStatus("Bitte eine .xlsx-Datei auswählen.","error");
    return {successes:[],errors:["Keine gültige XLSX-Datei ausgewählt."]};
  }

  const kindLabel=expectedKind==="weekly"?"Wochenbericht":
    expectedKind==="sawline"?"Sägelinie":"Excel-Datei";
  setUploadStatus(`${files.length} ${kindLabel}-Datei(en) aus ${source} werden lokal geprüft …`,"working");

  const successes=[],importedWeeks=[],importedSawlineWeeks=[],errors=[],persistQueue=[];

  for(const file of files){
    try{
      const sawlineMeta=sawlineFileMeta(file.name,{required:false});
      const weeklyMeta=weeklyFileMeta(file.name,{required:false});
      let kind=null;

      if(expectedKind==="sawline"){
        if(!sawlineMeta)throw new Error("Dieser Upload akzeptiert nur Dateien im Format Sh_XX_YY.xlsx.");
        kind="sawline";
      }else if(expectedKind==="weekly"){
        if(!weeklyMeta)throw new Error("Dieser Upload akzeptiert nur Dateien im Format KW-XX-20XX.xlsx.");
        kind="weekly";
      }else{
        if(sawlineMeta)kind="sawline";
        else if(weeklyMeta)kind="weekly";
        else throw new Error("Unbekannter Dateiname. Erlaubt sind KW-XX-20XX.xlsx und Sh_XX_YY.xlsx.");
      }

      const matrix=await readFirstWorksheet(file);
      const bundle=kind==="sawline"
        ?parseSawlineReport(matrix,file.name)
        :parseWeeklyReport(matrix,file.name);

      mergeAnyImportedBundle(bundle,{persist:false});
      persistQueue.push(bundle);   // gesammelt speichern (ein Schreibvorgang, robuster bei vielen Dateien)

      const warningText=Array.isArray(bundle.warnings)&&bundle.warnings.length
        ?` · ${bundle.warnings.length} Hinweis(e)`:"";
      successes.push(`${bundle.weekLabel}/${bundle.year||2026} · ${kind==="sawline"?"Sägelinie":"Wochenbericht"}${warningText}`);

      if(kind==="sawline")importedSawlineWeeks.push(bundle.week);
      else importedWeeks.push(bundle.week);
    }catch(error){
      errors.push(`${file.name}: ${error.message}`);
      console.error(error);
    }
  }

  const persistResult=persistImportedBundlesBatch(persistQueue);

  if(successes.length){
    // Auf das neueste geladene Jahr projizieren (Header-Jahr wählt anschließend um)
    const years=weeklyYears();
    projectDashboardYear(years.length?years[years.length-1]:historyDashboardYear());
    rebuildWeekSelectors(true);
    rebuildSawlineSelectors(importedSawlineWeeks.length?Math.max(...importedSawlineWeeks):null);
    const wks=availableDashboardWeeks();
    if(wks.length)setGlobalDisplayWeek(Math.max(...wks),{showHint:false});
    else updateAll();
    refreshHistoryControls();   // Historie-Auswahllisten (Jahr/KW/Datensatz) an neue Daten anpassen
    renderKpiWorkspace();
    renderStatisticsBoard();
  }

  // Statusmeldung zusammenfassen (nicht jede einzelne Datei auflisten)
  const parts=[];
  if(successes.length)parts.push(`${successes.length} Datei(en) importiert`);
  if(errors.length)parts.push(`${errors.length} fehlerhaft: ${errors.slice(0,6).join(" | ")}${errors.length>6?" | …":""}`);
  if(persistResult.quotaHit)parts.push(`Speicher voll – nur ${persistResult.saved} Import(e) bleiben nach Neuladen erhalten. Bitte weniger Dateien gleichzeitig laden oder das eigenständige Dashboard (index.html) nutzen.`);
  const state=errors.length||persistResult.quotaHit?"error":"success";
  setUploadStatus(parts.length?parts.join(" · "):"Keine Dateien importiert.",state);

  excelUpload.value="";
  pendingLocalUploadKind="auto";
  return {successes,errors,persist:persistResult};
}


const TAB_ORDER_STORAGE_KEY="kwDashboardTabOrderV5";
const DEFAULT_TAB_ORDER=["countryPoints","assistant","history","sales","einkauf","production","sawline","overview","trends","annual","statistics","quality","infrastructure","land","countryCompare","worldmap","details","builder"];
let draggedTabButton=null;
let suppressNextTabClick=false;
let touchTabTimer=null;
let touchTabButton=null;
let touchTabSorting=false;

function tabViewButtons(){
  return [...nav.querySelectorAll('button[data-view]')];
}
function currentTabOrder(){
  return tabViewButtons().map(button=>button.dataset.view);
}
function clearTabDropMarkers(){
  tabViewButtons().forEach(button=>button.classList.remove("tab-drop-before","tab-drop-after"));
}
function showTabOrderToast(message){
  if(!document.getElementById("tabOrderToast"))return;
  tabOrderToast.textContent=message;
  tabOrderToast.classList.add("visible");
  clearTimeout(window.__tabOrderToastTimer);
  window.__tabOrderToastTimer=setTimeout(()=>tabOrderToast.classList.remove("visible"),1800);
}
function syncViewOrderToTabs(){
  const main=document.querySelector("main");
  if(!main)return;
  tabViewButtons().forEach(button=>{
    const view=document.getElementById(button.dataset.view);
    if(view)main.appendChild(view);
  });
}
function saveTabOrder({notify=false}={}){
  storageSet(TAB_ORDER_STORAGE_KEY,JSON.stringify(currentTabOrder()));
  syncViewOrderToTabs();
  if(notify){
    const first=tabViewButtons()[0];
    showTabOrderToast(`Reihenfolge gespeichert · Startansicht: ${first?.textContent?.trim()||"erster Reiter"}`);
  }
}
function applyTabOrder(order){
  const actionButton=nav.querySelector('button[data-action]');
  const buttonsByView=new Map(tabViewButtons().map(button=>[button.dataset.view,button]));
  const validOrder=[...new Set([...(Array.isArray(order)?order:[]),...DEFAULT_TAB_ORDER])]
    .filter(view=>buttonsByView.has(view));
  validOrder.forEach(view=>nav.insertBefore(buttonsByView.get(view),actionButton));
  tabViewButtons().filter(button=>!validOrder.includes(button.dataset.view))
    .forEach(button=>nav.insertBefore(button,actionButton));
  syncViewOrderToTabs();
}
function loadTabOrder(){
  try{
    const stored=JSON.parse(storageGet(TAB_ORDER_STORAGE_KEY)||"null");
    applyTabOrder(Array.isArray(stored)?stored:DEFAULT_TAB_ORDER);
  }catch(error){
    applyTabOrder(DEFAULT_TAB_ORDER);
  }
}
function activateDashboardTab(button,{update=true}={}){
  if(!button)return;
  nav.querySelectorAll("button").forEach(item=>item.classList.remove("active"));
  button.classList.add("active");
  if(button.dataset.action==="monitor"){
    document.body.classList.add("monitor-mode");
    document.querySelectorAll(".view").forEach(view=>view.classList.add("active"));
  }else{
    document.body.classList.remove("monitor-mode");
    document.querySelectorAll(".view").forEach(view=>view.classList.remove("active"));
    document.getElementById(button.dataset.view)?.classList.add("active");
  }
  if(update)requestAnimationFrame(updateAll);
}
function activateFirstOrderedTab(){
  activateDashboardTab(tabViewButtons()[0],{update:false});
}
function resetTabOrder(){
  storageRemove(TAB_ORDER_STORAGE_KEY);
  applyTabOrder(DEFAULT_TAB_ORDER);
  activateFirstOrderedTab();
  requestAnimationFrame(updateAll);
  showTabOrderToast("Ursprüngliche Tab-Reihenfolge wiederhergestellt.");
}
function placeDraggedTab(dragged,target,clientX=null){
  if(!dragged||!target||dragged===target||!target.dataset.view)return;
  const rect=target.getBoundingClientRect();
  const after=clientX===null?false:clientX>rect.left+rect.width/2;
  if(after)target.after(dragged);
  else target.before(dragged);
}
function bindTabSorting(){
  tabViewButtons().forEach(button=>{
    button.draggable=true;
    button.title=(button.title?button.title+" · ":"")+"Ziehen, um die Reihenfolge zu ändern";

    button.addEventListener("dragstart",event=>{
      draggedTabButton=button;
      button.classList.add("tab-dragging");
      event.dataTransfer.effectAllowed="move";
      event.dataTransfer.setData("text/plain",button.dataset.view);
    });
    button.addEventListener("dragover",event=>{
      if(!draggedTabButton||draggedTabButton===button)return;
      event.preventDefault();
      clearTabDropMarkers();
      const rect=button.getBoundingClientRect();
      button.classList.add(event.clientX>rect.left+rect.width/2?"tab-drop-after":"tab-drop-before");
      event.dataTransfer.dropEffect="move";
    });
    button.addEventListener("drop",event=>{
      if(!draggedTabButton||draggedTabButton===button)return;
      event.preventDefault();
      placeDraggedTab(draggedTabButton,button,event.clientX);
      clearTabDropMarkers();
      saveTabOrder({notify:true});
    });
    button.addEventListener("dragend",()=>{
      button.classList.remove("tab-dragging");
      clearTabDropMarkers();
      draggedTabButton=null;
    });

    button.addEventListener("pointerdown",event=>{
      if(event.pointerType!=="touch")return;
      touchTabButton=button;
      touchTabSorting=false;
      clearTimeout(touchTabTimer);
      touchTabTimer=setTimeout(()=>{
        touchTabSorting=true;
        suppressNextTabClick=true;
        nav.classList.add("tab-touch-sorting");
        button.classList.add("tab-dragging");
        try{button.setPointerCapture(event.pointerId)}catch(error){}
        navigator.vibrate?.(35);
      },420);
    });
    button.addEventListener("pointermove",event=>{
      if(event.pointerType!=="touch"||!touchTabSorting||touchTabButton!==button)return;
      event.preventDefault();
      const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('#nav button[data-view]');
      if(target&&target!==button){
        placeDraggedTab(button,target,event.clientX);
        clearTabDropMarkers();
        const rect=target.getBoundingClientRect();
        target.classList.add(event.clientX>rect.left+rect.width/2?"tab-drop-after":"tab-drop-before");
      }
    });
    const finishTouchSort=event=>{
      if(event.pointerType!=="touch")return;
      clearTimeout(touchTabTimer);
      if(touchTabSorting&&touchTabButton===button){
        saveTabOrder({notify:true});
        setTimeout(()=>suppressNextTabClick=false,80);
      }
      button.classList.remove("tab-dragging");
      nav.classList.remove("tab-touch-sorting");
      clearTabDropMarkers();
      touchTabSorting=false;
      touchTabButton=null;
    };
    button.addEventListener("pointerup",finishTouchSort);
    button.addEventListener("pointercancel",finishTouchSort);

    button.addEventListener("keydown",event=>{
      if(!event.altKey||!event.shiftKey||!["ArrowLeft","ArrowRight"].includes(event.key))return;
      event.preventDefault();
      const buttons=tabViewButtons(),index=buttons.indexOf(button);
      const targetIndex=event.key==="ArrowLeft"?index-1:index+1;
      if(targetIndex<0||targetIndex>=buttons.length)return;
      if(event.key==="ArrowLeft")buttons[targetIndex].before(button);
      else buttons[targetIndex].after(button);
      saveTabOrder({notify:true});
      button.focus();
    });
  });
}

let pendingLocalUploadKind="auto";
const QUESTION_COUNTRY_ALIASES={
  "frankreich":"FRANKREICH",
  "deutschland":"DEUTSCHLAND",
  "grossbritannien":"GROSSBRITANNIEN",
  "großbritannien":"GROSSBRITANNIEN",
  "england":"GROSSBRITANNIEN",
  "irland":"IRLAND",
  "nir":"NIR",
  "nordirland":"NIR",
  "niederlande":"NIEDERLANDE",
  "holland":"NIEDERLANDE",
  "belgien":"BELGIEN",
  "italien":"ITALIEN",
  "spanien":"SPANIEN",
  "portugal":"PORTUGAL",
  "osterreich":"ÖSTERREICH",
  "österreich":"ÖSTERREICH",
  "schweiz":"SCHWEIZ",
  "sonstige":"SONSTIGE"
};

function normalizeDashboardQuestion(value){
  return String(value||"").trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g,"")
    .replace(/ß/g,"ss");
}
function extractQuestionWeek(value){
  const match=String(value||"").match(/\b(?:kw|kalenderwoche)\s*[-.:]?\s*0?([1-9]|[1-4]\d|5[0-3])\b/i);
  return match?Number(match[1]):null;
}
function detectQuestionCountry(normalizedQuestion){
  const aliases=Object.entries(QUESTION_COUNTRY_ALIASES)
    .sort((a,b)=>normalizeDashboardQuestion(b[0]).length-normalizeDashboardQuestion(a[0]).length);
  for(const [alias,country] of aliases){
    const normalizedAlias=normalizeDashboardQuestion(alias);
    if(normalizedQuestion.includes(normalizedAlias))return country;
  }
  return null;
}
function questionAvailableWeeks(kind="weekly"){
  if(kind==="sawline"){
    return [...new Set(DATA.sawlineReports.map(row=>Number(row["KW Nr."])).filter(Number.isFinite))].sort((a,b)=>a-b);
  }
  return availableDashboardWeeks();
}
function resolveQuestionWeek(requestedWeek,kind="weekly"){
  const weeks=questionAvailableWeeks(kind);
  if(!weeks.length)return {requested:requestedWeek,selected:null,exact:false,latest:null};
  const requested=Number(requestedWeek)||Math.max(...weeks);
  if(weeks.includes(requested))return {requested,selected:requested,exact:true,latest:Math.max(...weeks)};
  const prior=weeks.filter(week=>week<=requested);
  const selected=prior.length?Math.max(...prior):Math.min(...weeks);
  return {requested,selected,exact:false,latest:Math.max(...weeks)};
}
function weeklyQuestionRow(week){
  return DATA.weekly.find(row=>Number(row["KW Nr."])===Number(week))||null;
}
function orderQuestionRow(week){
  return DATA.orderWindow.find(row=>weekNo(row.KW)===Number(week))||null;
}
function dryingQuestionRow(week){
  return DATA.drying.find(row=>weekNo(row["Berichts-KW"])===Number(week))||null;
}
function shipmentQuestionRow(week){
  return DATA.shipments.find(row=>weekNo(row.KW)===Number(week))||null;
}
function questionWeekPrefix(resolution,kindLabel="Wochenbericht"){
  if(resolution.exact)return `<strong>KW${String(resolution.selected).padStart(2,"0")}:</strong> `;
  return `<strong>KW${String(resolution.requested).padStart(2,"0")} ist im ${kindLabel} noch nicht vorhanden.</strong> Angezeigt wird die letzte passende verfügbare KW${String(resolution.selected).padStart(2,"0")}. `;
}
function questionAnswerOrder(resolution){
  const row=orderQuestionRow(resolution.selected);
  if(!row)return questionWeekPrefix(resolution)+"Keine Auftragsbestandswerte verfügbar.";
  return questionWeekPrefix(resolution)+
    `4‑Wochen-Bestand ${format(row["4W gemeldet"],"m3")}, `+
    `8‑Wochen-Bestand ${format(row["8W Gesamt"],"m3")}, `+
    `inklusive Reservierungen ${format(row["8W mit Reserv."],"m3")} und `+
    `Lagerbestand ${format(row.Lagerbestand,"m3")}.`;
}
function questionAnswerIncoming(resolution){
  const row=weeklyQuestionRow(resolution.selected);
  if(!row)return questionWeekPrefix(resolution)+"Kein Auftragseingang verfügbar.";
  return questionWeekPrefix(resolution)+
    `Der Auftragseingang beträgt ${format(row["Auftragseingang gesamt (m³)"],"m3")}.`;
}
function questionAnswerSales(resolution){
  const row=weeklyQuestionRow(resolution.selected);
  if(!row)return questionWeekPrefix(resolution)+"Keine Umsatzwerte verfügbar.";
  return questionWeekPrefix(resolution)+
    `Fakturierte Umsatzmenge ${format(row["Umsatzmenge gesamt (m³)"],"m3")}, `+
    `Ø‑Preis ${format(row["Ø Preis gesamt (€/m³)"],"price")}, `+
    `DB ${format(row["DB (€/m³)"],"price")} beziehungsweise ${format(row["DB Netto (€)"],"currency")}.`;
}
function questionAnswerProduction(resolution,normalizedQuestion){
  const rows=DATA.productionCurrent.filter(row=>row["KW Nr."]===resolution.selected);
  if(!rows.length)return questionWeekPrefix(resolution)+"Keine Produktionswerte verfügbar.";
  let preferred=null;
  if(normalizedQuestion.includes("rhp"))preferred="RHP";
  else if(normalizedQuestion.includes("gatter"))preferred="Gatter";
  else if(normalizedQuestion.includes("sage")||normalizedQuestion.includes("saege"))preferred="Säge";
  const selected=preferred?rows.find(row=>row.Kennzahl===preferred):rows.find(row=>row.Kennzahl==="Gesamt Fm");
  const summary=rows.map(row=>`${row.Kennzahl}: ${format(row.Aktuell,row.Einheit==="m³"?"m3":"fm")}`).join(" · ");
  return questionWeekPrefix(resolution)+(selected?`${selected.Kennzahl} ${format(selected.Aktuell,selected.Einheit==="m³"?"m3":"fm")}. `:"")+summary;
}
function questionSawlineMetric(normalizedQuestion){
  const candidates=[
    ["storzeit","STÖRZEIT"],
    ["stoerzeit","STÖRZEIT"],
    ["ausbeute gesamt","AUSBEUTE (%) Gesamt"],
    ["ausbeute gatter","AUSBEUTE (%) Gatter"],
    ["ausbeute","AUSBEUTE"],
    ["laufmeter","LAUFMETER"],
    ["stuckzahl","STÜCKZAHL"],
    ["stueckzahl","STÜCKZAHL"],
    ["festmeter","FESTMETER"],
    ["kubikmeter","KUBIKMETER"],
    ["sagezeit","SÄGEZEIT"],
    ["saegezeit","SÄGEZEIT"],
    ["produktionszeit","PRODUKTIONSZEIT"],
    ["fm/min","Fm/min"],
    ["m3/min","m3/min"],
    ["spaner","Spaner"]
  ];
  return candidates.find(([keyword])=>normalizedQuestion.includes(keyword))?.[1]||null;
}
function questionAnswerSawline(resolution,normalizedQuestion){
  const rows=DATA.sawlineReports.filter(row=>row["KW Nr."]===resolution.selected);
  if(!rows.length)return questionWeekPrefix(resolution,"Sägelinienbericht")+"Keine Sägelinienwerte verfügbar.";
  const metricHint=questionSawlineMetric(normalizedQuestion);
  const selected=metricHint?rows.find(row=>normalizeDashboardQuestion(row.KPI).includes(normalizeDashboardQuestion(metricHint))):rows.find(row=>row.Zeile===25)||rows[0];
  return questionWeekPrefix(resolution,"Sägelinienbericht")+
    `${selected.KPI}: ${format(selected.Summe,selected.Werttyp)}. Quelle: ${esc(selected.Quelldatei)}.`;
}
function questionAnswerDrying(resolution){
  const row=dryingQuestionRow(resolution.selected);
  if(!row)return questionWeekPrefix(resolution)+"Keine Trocknungswerte verfügbar.";
  return questionWeekPrefix(resolution)+
    `Trocknungsbestand: ${format(row["Summe Hauptspalte"],"m3")}. `+
    `${row["Ziel-KW 1"]||"–"} ${format(row["Wert 1"],"m3")}, `+
    `${row["Ziel-KW 2"]||"–"} ${format(row["Wert 2"],"m3")}, `+
    `${row["Ziel-KW 3"]||"–"} ${format(row["Wert 3"],"m3")}.`;
}
function questionAnswerShipments(resolution){
  const row=shipmentQuestionRow(resolution.selected);
  if(!row)return questionWeekPrefix(resolution)+"Keine Verladungswerte verfügbar.";
  return questionWeekPrefix(resolution)+
    `${format(row["Gesamt gemeldet"],"number")} Verladungen insgesamt, `+
    `Ø ${format(row["Ø gemeldet"],"number")} je aktivem Tag.`;
}
function questionAnswerCountry(resolution,country){
  const row=(DATA.countryComparison||[]).find(entry=>
    entry["KW Nr."]===resolution.selected&&entry.Land===country
  );
  if(!row)return questionWeekPrefix(resolution)+`Für ${country||"das Land"} liegen keine Länderwerte vor.`;
  return questionWeekPrefix(resolution)+
    `${country}: M% ${format(row["M%"],"pctpoint")}, `+
    `M% HW‑Säge ${format(row["M% HW-Säge"],"pctpoint")}, `+
    `M% SW ${format(row["M% SW"],"pctpoint")}, `+
    `Ø‑Preis HW‑Säge ${format(row["Ø-Preis HW-Säge"],"price")}, `+
    `Ø‑Preis Gesamt ${format(row["Ø-Preis Gesamt"],"price")}.`;
}
function questionLandMetric(normalizedQuestion){
  if(normalizedQuestion.includes("preis")){
    if(normalizedQuestion.includes("hw")||normalizedQuestion.includes("hauptware"))return "Ø-Preis HW-Säge";
    return "Ø-Preis Gesamt";
  }
  if(normalizedQuestion.includes("seitenware")||normalizedQuestion.includes("m% sw"))return "M% SW";
  if(normalizedQuestion.includes("hw")||normalizedQuestion.includes("hauptware"))return "M% HW-Säge";
  return "M%";
}
function questionAnswerLand(resolution,normalizedQuestion){
  const metric=questionLandMetric(normalizedQuestion);
  const type=metric.includes("Preis")?"price":"pctpoint";
  const rows=(DATA.countryComparison||[])
    .filter(row=>row["KW Nr."]===resolution.selected&&row.Land!=="NIR"&&n(row[metric])!==null)
    .sort((a,b)=>n(b[metric])-n(a[metric]));
  if(!rows.length)return questionWeekPrefix(resolution)+"Für die gewählte Länderkennzahl liegen keine Werte vor.";
  const top=rows.slice(0,3).map(row=>`${row.Land}: ${format(row[metric],type)}`).join(" · ");
  return questionWeekPrefix(resolution)+`Länderranking nach ${metric}: ${top}.`;
}
function questionAnswerQuality(resolution){
  const label=`KW${String(resolution.selected).padStart(2,"0")}`;
  const issues=DATA.issues.filter(issue=>String(issue.KW||"")===label);
  if(!issues.length)return questionWeekPrefix(resolution)+"Für diese Woche sind keine gesonderten Prüffälle hinterlegt.";
  const high=issues.filter(issue=>issue.Priorität==="Hoch").length;
  const medium=issues.filter(issue=>issue.Priorität==="Mittel").length;
  return questionWeekPrefix(resolution)+`${issues.length} Prüffälle, davon ${high} hoch und ${medium} mittel priorisiert.`;
}
function detectDashboardQuestionTopic(normalizedQuestion,country){
  if(normalizedQuestion.includes("auftragsbestand")||normalizedQuestion.includes("4 wochenbestand")||
     normalizedQuestion.includes("8 wochenbestand")||normalizedQuestion.includes("4 wochenfenster")){
    return {id:"order",view:"details",target:"#orderChart",kind:"weekly",answer:questionAnswerOrder};
  }
  if(normalizedQuestion.includes("lagerbestand")||normalizedQuestion.match(/\blager\b/)){
    return {id:"lager",view:"details",target:"#orderChart",kind:"weekly",answer:questionAnswerOrder};
  }
  if(normalizedQuestion.includes("auftragseingang")||normalizedQuestion.includes("a eingang")){
    return {id:"incoming",view:"trends",target:"#volumeChart",kind:"weekly",answer:questionAnswerIncoming};
  }
  if(normalizedQuestion.includes("trocknung")||normalizedQuestion.includes("trocknungsbestand")){
    return {id:"drying",view:"details",target:"#dryingTable",kind:"weekly",answer:questionAnswerDrying};
  }
  if(normalizedQuestion.includes("verladung")||normalizedQuestion.includes("verladungen")){
    return {id:"shipments",view:"details",target:"#shipChart",kind:"weekly",answer:questionAnswerShipments};
  }
  if(normalizedQuestion.includes("sagelinie")||normalizedQuestion.includes("saegelinie")||
     normalizedQuestion.includes("spaner")||normalizedQuestion.includes("storzeit")||
     normalizedQuestion.includes("stoerzeit")||normalizedQuestion.includes("ausbeute")){
    return {id:"sawline",view:"sawline",target:"#sawlineTable",kind:"sawline",answer:questionAnswerSawline};
  }
  if(country||normalizedQuestion.includes("landervergleich")||normalizedQuestion.includes("laendervergleich")||
     normalizedQuestion.includes("m%")||normalizedQuestion.includes("hw sage")||
     normalizedQuestion.includes("hw saege")||normalizedQuestion.includes("seitenware")){
    return {
      id:"country",
      view:country?"countryCompare":"land",
      target:country?"#countryCompareTable":"#landTable",
      kind:"weekly",
      answer:country
        ?(resolution)=>questionAnswerCountry(resolution,country)
        :(resolution,question)=>questionAnswerLand(resolution,question)
    };
  }
  if(normalizedQuestion.includes("datenqualitat")||normalizedQuestion.includes("datenqualitaet")||
     normalizedQuestion.includes("pruffall")||normalizedQuestion.includes("prueffall")||
     normalizedQuestion.includes("fehler")){
    return {id:"quality",view:"quality",target:"#issueTable",kind:"weekly",answer:questionAnswerQuality};
  }
  if(normalizedQuestion.includes("statistik")||normalizedQuestion.includes("3 monate")||
     normalizedQuestion.includes("6 monate")||normalizedQuestion.includes("vorjahr")){
    return {id:"statistics",view:"statistics",target:"#statisticsWorkspace",kind:"weekly",
      answer:(resolution)=>questionWeekPrefix(resolution)+"Die Statistik-Modulwand wurde geöffnet und auf die passende End-KW gestellt."};
  }
  if(normalizedQuestion.includes("trend")||normalizedQuestion.includes("entwicklung")||
     normalizedQuestion.includes("ytd")){
    return {id:"trends",view:"trends",target:"#weeklyTable",kind:"weekly",
      answer:(resolution)=>questionWeekPrefix(resolution)+"Die Wochen-Trends und YTD-Auswertungen wurden geöffnet."};
  }
  if(normalizedQuestion.includes("rhp")||normalizedQuestion.includes("produktion")||
     normalizedQuestion.includes("gatter")){
    return {id:"production",view:"production",target:"#productionKpis",kind:"weekly",answer:questionAnswerProduction};
  }
  if(normalizedQuestion.includes("umsatz")||normalizedQuestion.includes("fakturiert")||
     normalizedQuestion.includes("deckungsbeitrag")||normalizedQuestion.match(/\bdb\b/)||
     normalizedQuestion.includes("preis")){
    return {id:"sales",view:"sales",target:"#salesKpis",kind:"weekly",answer:questionAnswerSales};
  }
  if(normalizedQuestion.includes("kpi")||normalizedQuestion.includes("individuell")||
     normalizedQuestion.includes("eigene wand")){
    return {id:"builder",view:"builder",target:"#kpiWorkspace",kind:"weekly",
      answer:(resolution)=>questionWeekPrefix(resolution)+"Die Eigene KPI-Wand wurde geöffnet."};
  }
  return {id:"overview",view:"overview",target:"#kpis",kind:"weekly",
    answer:(resolution)=>questionWeekPrefix(resolution)+"Die Management-Übersicht wurde geöffnet. Formuliere die Frage mit einem Begriff wie Umsatz, Produktion, Auftragsbestand, Land oder Sägelinie für eine genauere Markierung."};
}
function setQuestionSelectValue(select,value){
  if(!select)return false;
  const option=[...select.options].find(entry=>Number(entry.value)===Number(value)||entry.value===String(value));
  if(!option)return false;
  select.value=option.value;
  return true;
}
function applyQuestionWeek(topic,resolution,country,normalizedQuestion){
  const week=resolution.selected;
  if(week===null)return;

  if(topic.kind==="weekly"&&availableDashboardWeeks().includes(week)){
    setGlobalDisplayWeek(week,{showHint:false});
  }

  if(topic.view==="details"){
    setQuestionSelectValue(weekFrom,week);
    setQuestionSelectValue(weekTo,week);
  }else if(topic.view==="trends"){
    const weeks=availableDashboardWeeks();
    const startCandidates=weeks.filter(value=>value<=week).slice(-10);
    if(startCandidates.length)setQuestionSelectValue(weekFrom,startCandidates[0]);
    setQuestionSelectValue(weekTo,week);
  }else if(topic.view==="sales"){
    setQuestionSelectValue(salesWeek,week);
  }else if(topic.view==="production"){
    setQuestionSelectValue(productionWeek,week);
  }else if(topic.view==="sawline"){
    setQuestionSelectValue(sawlineWeek,week);
  }else if(topic.view==="countryCompare"){
    setQuestionSelectValue(countryCompareWeek,week);
    if(country&&[...countryCompareCountry.options].some(option=>option.value===country)){
      countryCompareCountry.value=country;
    }
  }else if(topic.view==="land"){
    const requestedEnd=resolution.requested||week;
    setQuestionSelectValue(landEndWeek,requestedEnd);
    const metric=questionLandMetric(normalizedQuestion);
    if([...landMetricSelect.options].some(option=>option.value===metric))landMetricSelect.value=metric;
  }else if(topic.view==="statistics"){
    setQuestionSelectValue(statisticsBuilderWeek,week);
  }else if(topic.view==="builder"){
    setQuestionSelectValue(builderWeek,week);
  }
  updateAll();
}
function clearDashboardQuestionMarks(){
  document.querySelectorAll(".question-target-highlight").forEach(element=>element.classList.remove("question-target-highlight"));
  document.querySelectorAll(".question-tab-target").forEach(element=>element.classList.remove("question-tab-target"));
  document.querySelectorAll(".question-marker-badge").forEach(element=>element.remove());
  document.querySelectorAll(".question-row-highlight").forEach(element=>element.classList.remove("question-row-highlight"));
}
function revealDashboardQuestionTarget(target){
  if(!target)return;
  const windowElement=target.matches?.(".card,.kpi,.detail-kpi,.sawline-kpi-card,.quality-card")
    ?target
    :target.closest?.(".card,.kpi,.detail-kpi,.sawline-kpi-card,.quality-card");
  const element=windowElement||target;
  if(element.classList.contains("standard-window-hidden")){
    element.classList.remove("standard-window-hidden");
    try{
      closedStandardWindows.delete(standardWindowKey(element));
      saveClosedStandardWindows();
    }catch(error){}
  }
}
function markDashboardQuestionTarget(topic,resolution,country,normalizedQuestion){
  clearDashboardQuestionMarks();
  const tabButton=nav.querySelector(`button[data-view="${topic.view}"]`);
  tabButton?.classList.add("question-tab-target");

  let rawTarget=document.querySelector(topic.target);
  let target=rawTarget?.closest?.(".card,.kpi,.detail-kpi,.sawline-kpi-card,.quality-card")||rawTarget;
  if(!target)target=document.getElementById(topic.view)?.querySelector(".section-head")||document.getElementById(topic.view);
  if(!target)return;

  revealDashboardQuestionTarget(target);
  target.classList.add("question-target-highlight");
  const badge=document.createElement("div");
  badge.className="question-marker-badge";
  badge.textContent="Antwort zur Frage";
  target.appendChild(badge);

  const selectedWeek=`KW${String(resolution.selected).padStart(2,"0")}`;
  const tables=target.querySelectorAll("table");
  tables.forEach(table=>{
    [...table.querySelectorAll("tbody tr")].forEach(row=>{
      const rowText=normalizeDashboardQuestion(row.textContent);
      const countryMatch=country&&rowText.includes(normalizeDashboardQuestion(country));
      const weekMatch=rowText.includes(normalizeDashboardQuestion(selectedWeek));
      const metricHint=topic.id==="sawline"&&questionSawlineMetric(normalizedQuestion);
      const metricMatch=metricHint&&rowText.includes(normalizeDashboardQuestion(metricHint));
      if(countryMatch||weekMatch||metricMatch)row.classList.add("question-row-highlight");
    });
  });

  setTimeout(()=>target.scrollIntoView({behavior:"smooth",block:"center"}),80);
}
function showDashboardQuestionResult(message,type="success"){
  dashboardQuestionResult.className=`dashboard-question-result visible${type==="success"?"":` ${type}`}`;
  dashboardQuestionResult.innerHTML=message;
}
const QUESTION_AGG_KEYWORDS=["jahr","gesamt","insgesamt","summe","summiert","aufgelaufen","aufgelaufene","total","kumuliert","alle wochen","ueber alle","ganze jahr","gesamtes jahr"];
const QUESTION_AVG_KEYWORDS=["durchschnitt","schnitt","mittel","average","je woche","pro woche"];
function isAggregateQuestion(nq){
  return QUESTION_AGG_KEYWORDS.some(k=>nq.includes(k))||QUESTION_AVG_KEYWORDS.some(k=>nq.includes(k));
}
function wantsAverage(nq){return QUESTION_AVG_KEYWORDS.some(k=>nq.includes(k))&&!QUESTION_AGG_KEYWORDS.some(k=>nq.includes(k))}
function sumSawlineByZeile(zeile){return DATA.sawlineReports.filter(r=>r.Zeile===zeile).reduce((s,r)=>s+(n(r.Summe)||0),0)}
function sawlineSummeValues(kpi){return DATA.sawlineReports.filter(r=>r.KPI===kpi).map(r=>n(r.Summe)).filter(v=>v!==null)}
function resolveSawlineKpiName(fragment){
  if(!fragment)return null;
  const nf=normalizeDashboardQuestion(fragment);
  return [...new Set(DATA.sawlineReports.map(r=>r.KPI))].find(kpi=>normalizeDashboardQuestion(kpi).includes(nf))||null;
}
function aggregateSawlineAnswer(nq){
  const weeks=availableSawlineWeeks();
  if(!weeks.length)return {view:"sawline",target:"#sawlineTable",html:"<strong>Sägelinie:</strong> Es sind noch keine Sägelinien-Dateien (Sh_XX_YY.xlsx) geladen."};
  const wk=weeks.length,span=`KW${String(Math.min(...weeks)).padStart(2,"0")}–KW${String(Math.max(...weeks)).padStart(2,"0")}`;
  if(nq.includes("storzeit")||nq.includes("stoerzeit")){
    const prod=sumSawlineByZeile(19),saw=sumSawlineByZeile(20),stoer=Math.max(0,prod-saw);
    const pctVals=sawlineSummeValues("STÖRZEIT (%)");
    const avgPct=pctVals.length?pctVals.reduce((s,v)=>s+v,0)/pctVals.length:null;
    return {view:"sawline",target:"#sawlineTable",html:
      `<strong>Störzeit Sägelinie · Jahr (${wk} geladene Wochen, ${span}):</strong><br>`+
      `Aufgelaufene Störzeit ≈ <strong>${fmt0.format(stoer)} min</strong> (≈ ${fmtNum.format(stoer/60)} h).<br>`+
      `Herleitung über alle Dateien: Σ Produktionszeit ${fmt0.format(prod)} min − Σ effektive Sägezeit ${fmt0.format(saw)} min.<br>`+
      `Ø Störzeitquote über alle Wochen: ${avgPct===null?"–":fmt2.format(avgPct)+" %"}.`};
  }
  let kpi=resolveSawlineKpiName(questionSawlineMetric(nq));
  if(!kpi&&(nq.includes("sagezeit")||nq.includes("saegezeit")))kpi="effektive SÄGEZEIT gesamt";
  if(!kpi&&nq.includes("produktionszeit"))kpi="PRODUKTIONSZEIT gesamt";
  if(kpi){
    const sample=DATA.sawlineReports.find(r=>r.KPI===kpi),type=sample?.Werttyp,vals=sawlineSummeValues(kpi);
    const additive=SAWLINE_ADDITIVE_TYPES.has(type);
    if(additive&&!wantsAverage(nq)){
      const total=vals.reduce((s,v)=>s+v,0),avg=vals.length?total/vals.length:null;
      return {view:"sawline",target:"#sawlineTable",html:
        `<strong>${esc(kpi)} · Jahr (${wk} Wochen, ${span}):</strong> Σ über alle Dateien = <strong>${format(total,type)}</strong>. Ø je Woche: ${format(avg,type)}.`};
    }
    const avg=vals.length?vals.reduce((s,v)=>s+v,0)/vals.length:null;
    return {view:"sawline",target:"#sawlineTable",html:
      `<strong>${esc(kpi)} · Jahr (${wk} Wochen, ${span}):</strong> Ø der Wochenwerte = <strong>${format(avg,type)}</strong>${additive?"":" · Quoten/Raten werden gemittelt, nicht summiert"}.`};
  }
  return null;
}
function aggregateCountryAnswer(nq,country){
  if(!country)return null;
  const weeks=availableDashboardWeeks();
  let vol=0,rev=0,cnt=0;
  weeks.forEach(week=>{
    const weekly=DATA.weekly.find(r=>r["KW Nr."]===week);
    const total=n(weekly?.["Umsatzmenge gesamt (m³)"]),wprice=n(weekly?.["Ø Preis gesamt (€/m³)"]);
    const row=(DATA.countryComparison||[]).find(r=>r["KW Nr."]===week&&r.Land===country);
    const mp=n(row?.["M%"]);if(total===null||mp===null)return;
    const v=total*mp/100;vol+=v;cnt++;const price=n(row?.["Ø-Preis Gesamt"])??wprice??null;if(price!==null)rev+=v*price;
  });
  if(!cnt)return {view:"countryPoints",target:"#cpTable",html:`<strong>${esc(country)}:</strong> keine Länderdaten geladen.`};
  return {view:"countryPoints",target:"#cpTable",html:
    `<strong>${esc(country)} · Jahr (${cnt} Wochen):</strong> hergeleiteter Umsatz Σ ≈ <strong>${format(rev,"currency")}</strong>, Menge Σ ${format(vol,"m3")}, Ø-Preis ${format(vol?rev/vol:null,"price")}.`};
}
function aggregateWeeklyAnswer(nq){
  const weeks=availableDashboardWeeks();if(!weeks.length)return null;
  const wk=weeks.length,range=`${wk} Wochen, KW${String(Math.min(...weeks)).padStart(2,"0")}–KW${String(Math.max(...weeks)).padStart(2,"0")}`;
  const w=DATA.weekly,S=key=>w.reduce((s,r)=>s+(n(r[key])||0),0);
  if(nq.includes("verladung"))
    return {view:"annual",target:"#annualKpis",html:`<strong>Verladungen · Jahr (${range}):</strong> Σ = <strong>${fmt0.format(S("Verladungen gesamt"))}</strong> Verladungen.`};
  if(nq.includes("trocknung")||nq.includes("hobelung")||nq.includes("impragnierung")||nq.includes("impraegnierung")||nq.includes("veredelung"))
    return {view:"annual",target:"#annualRefineChart",html:`<strong>Veredelung · Jahr (${range}):</strong> Trocknung Σ ${format(S("Trocknung (m³)"),"m3")}, Hobelung Σ ${format(S("Hobelung (m³)"),"m3")}, Imprägnierung Σ ${format(S("Imprägnierung (m³)"),"m3")}.`};
  if(nq.includes("auftragseingang"))
    return {view:"annual",target:"#annualKpis",html:`<strong>Auftragseingang · Jahr (${range}):</strong> Σ = <strong>${format(S("Auftragseingang gesamt (m³)"),"m3")}</strong>.`};
  if(nq.includes("rhp"))
    return {view:"annual",target:"#annualKpis",html:`<strong>RHP · Jahr (${range}):</strong> Σ Wochenleistung = <strong>${format(S("RHP KW (fm)"),"fm")}</strong>.`};
  if(nq.includes("produktion"))
    return {view:"annual",target:"#annualKpis",html:`<strong>Produktion · Jahr (${range}):</strong> Σ = <strong>${format(S("Produktion KW gesamt (fm)"),"fm")}</strong> bzw. ${format(S("Produktion KW (m³)"),"m3")}.`};
  if(nq.includes("deckungsbeitrag")||/\bdb\b/.test(nq)){
    const menge=S("Umsatzmenge gesamt (m³)"),db=S("DB Netto (€)");
    return {view:"annual",target:"#annualKpis",html:`<strong>Deckungsbeitrag · Jahr (${range}):</strong> Σ DB Netto = <strong>${format(db,"currency")}</strong> · gewichtet ${format(menge?db/menge:null,"price")}.`};
  }
  if(nq.includes("umsatz")||nq.includes("erlos")||nq.includes("erloes")||nq.includes("umsatzmenge")||nq.includes("preis")){
    const menge=S("Umsatzmenge gesamt (m³)");
    const erlos=w.reduce((s,r)=>s+((n(r["Umsatzmenge gesamt (m³)"])||0)*(n(r["Ø Preis gesamt (€/m³)"])||0)),0);
    return {view:"annual",target:"#annualKpis",html:`<strong>Umsatz · Jahr (${range}):</strong> Menge Σ = <strong>${format(menge,"m3")}</strong> · Erlös (rechnerisch) ${format(erlos,"currency")} · Ø-Preis ${format(menge?erlos/menge:null,"price")}.`};
  }
  return null;
}
function buildAggregateAnswer(nq,country){
  const sawlineHint=["sagelinie","saegelinie","spaner","storzeit","stoerzeit","ausbeute","laufmeter","stuckzahl","stueckzahl","festmeter","kubikmeter","sagezeit","saegezeit","produktionszeit","fm/min","m3/min"].some(k=>nq.includes(k));
  if(sawlineHint){const a=aggregateSawlineAnswer(nq);if(a)return a;}
  if(country){const c=aggregateCountryAnswer(nq,country);if(c)return c;}
  const weekly=aggregateWeeklyAnswer(nq);if(weekly)return weekly;
  if(sawlineHint)return aggregateSawlineAnswer(nq);
  return null;
}
function markAggregateTarget(agg){
  clearDashboardQuestionMarks();
  const tabButton=nav.querySelector(`button[data-view="${agg.view}"]`);
  tabButton?.classList.add("question-tab-target");
  const rawTarget=document.querySelector(agg.target);
  const target=rawTarget?.closest?.(".card,.kpi,.detail-kpi,.sawline-kpi-card,.quality-card")||rawTarget||document.getElementById(agg.view);
  if(!target)return;
  revealDashboardQuestionTarget(target);
  target.classList.add("question-target-highlight");
  const badge=document.createElement("div");badge.className="question-marker-badge";badge.textContent="Antwort zur Frage";
  target.appendChild(badge);
  setTimeout(()=>target.scrollIntoView({behavior:"smooth",block:"center"}),80);
}
function processDashboardQuestion(){
  const raw=dashboardQuestionInput.value.trim();
  if(!raw){
    showDashboardQuestionResult("Bitte eine Frage oder einen Suchbegriff eingeben.","error");
    dashboardQuestionInput.focus();
    return;
  }

  const normalized=normalizeDashboardQuestion(raw);
  const requestedWeek=extractQuestionWeek(raw);
  const country=detectQuestionCountry(normalized);

  if(requestedWeek===null&&isAggregateQuestion(normalized)){
    const aggregate=buildAggregateAnswer(normalized,country);
    if(aggregate){
      const aggTab=nav.querySelector(`button[data-view="${aggregate.view}"]`);
      activateDashboardTab(aggTab);
      showDashboardQuestionResult(aggregate.html,"success");
      requestAnimationFrame(()=>requestAnimationFrame(()=>markAggregateTarget(aggregate)));
      return;
    }
  }

  const topic=detectDashboardQuestionTopic(normalized,country);
  const resolution=resolveQuestionWeek(requestedWeek,topic.kind);

  if(resolution.selected===null){
    showDashboardQuestionResult("Für diesen Datenbereich sind noch keine Kalenderwochen vorhanden.","error");
    return;
  }

  applyQuestionWeek(topic,resolution,country,normalized);
  const tabButton=nav.querySelector(`button[data-view="${topic.view}"]`);
  activateDashboardTab(tabButton);

  const answer=topic.answer(resolution,normalized,country);
  const resultType=resolution.exact||requestedWeek===null?"success":"warning";
  showDashboardQuestionResult(answer,resultType);

  requestAnimationFrame(()=>requestAnimationFrame(()=>
    markDashboardQuestionTarget(topic,resolution,country,normalized)
  ));
}
/* ---------- Analyse-/Frageseite: Zahlen und Zusammenhänge über alle Dateien ---------- */
function assistantMetrics(){
  const wk=key=>()=>DATA.weekly.map(r=>({week:r["KW Nr."],value:n(r[key])})).filter(p=>p.value!==null);
  const sw=kpi=>()=>DATA.sawlineReports.filter(r=>r.KPI===kpi).map(r=>({week:r["KW Nr."],value:n(r.Summe)})).filter(p=>p.value!==null);
  return [
    {id:"umsatzmenge",label:"Umsatzmenge",type:"m3",aliases:["umsatzmenge","umsatz","absatz","verkaufsmenge"],series:wk("Umsatzmenge gesamt (m³)")},
    {id:"preis",label:"Ø-Preis",type:"price",aliases:["o-preis","preis","durchschnittspreis","verkaufspreis"],series:wk("Ø Preis gesamt (€/m³)")},
    {id:"db",label:"DB Netto",type:"currency",aliases:["db netto","deckungsbeitrag netto","deckungsbeitrag"],series:wk("DB Netto (€)")},
    {id:"dbm3",label:"DB je m³",type:"price",aliases:["db je m","db pro m","db/m"],series:wk("DB (€/m³)")},
    {id:"prodfm",label:"Produktion (fm)",type:"fm",aliases:["produktion fm","produktionsleistung","produktion"],series:wk("Produktion KW gesamt (fm)")},
    {id:"rhp",label:"RHP",type:"fm",aliases:["rhp"],series:wk("RHP KW (fm)")},
    {id:"auftragseingang",label:"Auftragseingang",type:"m3",aliases:["auftragseingang","ordereingang","bestellungen"],series:wk("Auftragseingang gesamt (m³)")},
    {id:"bestand4w",label:"Auftragsbestand 4W",type:"m3",aliases:["auftragsbestand","4-wochenbestand","4 wochenbestand","auftragsbuch"],series:wk("Auftragsbestand 4W (m³)")},
    {id:"lager",label:"Lagerbestand",type:"m3",aliases:["lagerbestand","lager"],series:wk("Lagerbestand (m³)")},
    {id:"verladungen",label:"Verladungen",type:"number",aliases:["verladungen","verladung"],series:wk("Verladungen gesamt")},
    {id:"trocknung",label:"Trocknung",type:"m3",aliases:["trocknung"],series:wk("Trocknung (m³)")},
    {id:"hobelung",label:"Hobelung",type:"m3",aliases:["hobelung"],series:wk("Hobelung (m³)")},
    {id:"impraegnierung",label:"Imprägnierung",type:"m3",aliases:["impragnierung","impraegnierung"],series:wk("Imprägnierung (m³)")},
    {id:"ausbeute",label:"Ausbeute Sägelinie",type:"pctpoint",aliases:["ausbeute"],series:sw("AUSBEUTE (%) Gesamt")},
    {id:"storzeit",label:"Störzeit Sägelinie",type:"pctpoint",aliases:["storzeit","stoerzeit"],series:sw("STÖRZEIT (%)")},
    {id:"laufmeter",label:"Laufmeter Sägelinie",type:"lfm",aliases:["laufmeter"],series:sw("LAUFMETER Spaner")},
    {id:"festmeter",label:"Festmeter Sägelinie",type:"fm",aliases:["festmeter"],series:sw("FESTMETER  Spaner")},
    {id:"kubikmeter",label:"Kubikmeter Sägelinie",type:"m3",aliases:["kubikmeter"],series:sw("KUBIKMETER  Spaner")},
    {id:"fmmin",label:"Fm/min Sägelinie",type:"fmmin",aliases:["fm/min","fm pro min"],series:sw("Fm/min (teff) gesamt")}
  ];
}
function assistantMatchMetrics(nq){
  const found=[];
  assistantMetrics().forEach(metric=>{
    let best=-1,len=0;
    metric.aliases.forEach(a=>{const i=nq.indexOf(a);if(i>=0&&(best<0||i<best)){best=i;len=a.length;}});
    if(best>=0)found.push({metric,index:best,len});
  });
  found.sort((a,b)=>a.index-b.index||b.len-a.len);
  const seen=new Set(),out=[];
  found.forEach(f=>{if(!seen.has(f.metric.id)){seen.add(f.metric.id);out.push(f.metric);}});
  return out;
}
const ASSIST_CORR_KEYWORDS=["zusammenhang","zusammenhaeng","korrelation","korreliert","beziehung","verhaltnis","verhaeltnis","abhang","abhaeng","einfluss","beeinfluss","hangt","haengt"," vs ","gegenueber","gleichlaufig","gegenlaufig"];
function assistantIsCorrelation(nq){return ASSIST_CORR_KEYWORDS.some(k=>nq.includes(k))}
function assistantPearson(points){
  const N=points.length;if(N<3)return null;
  let sx=0,sy=0,sxy=0,sxx=0,syy=0;
  points.forEach(({x,y})=>{sx+=x;sy+=y;sxy+=x*y;sxx+=x*x;syy+=y*y;});
  const cov=sxy-sx*sy/N,vx=sxx-sx*sx/N,vy=syy-sy*sy/N,d=Math.sqrt(vx*vy);
  return d?cov/d:null;
}
function assistantCorrText(r){
  if(r===null)return "nicht bestimmbar (zu wenige gemeinsame Wochen)";
  const a=Math.abs(r);
  const strength=a<.2?"praktisch keinen":a<.4?"einen schwachen":a<.6?"einen mittleren":a<.8?"einen starken":"einen sehr starken";
  return `${strength} ${r>=0?"gleichläufigen (positiven)":"gegenläufigen (negativen)"} Zusammenhang`;
}
function assistantCorrelationAnswer(mA,mB){
  const a=mA.series(),bMap=new Map(mB.series().map(p=>[p.week,p.value]));
  const pairs=a.filter(p=>bMap.has(p.week)).map(p=>({week:p.week,x:p.value,y:bMap.get(p.week)})).sort((u,v)=>u.week-v.week);
  const r=assistantPearson(pairs.map(p=>({x:p.x,y:p.y})));
  const dir=r===null?"":(r>=0?`Wenn ${mA.label} steigt, tendiert ${mB.label} ebenfalls nach oben.`:`Wenn ${mA.label} steigt, tendiert ${mB.label} nach unten.`);
  const html=`<strong>Zusammenhang ${esc(mA.label)} ↔ ${esc(mB.label)}</strong><br>`+
    (pairs.length<3?`Nur ${pairs.length} gemeinsame Wochen – für eine belastbare Korrelation zu wenig.`:
    `Korrelationskoeffizient <strong>r = ${fmt2.format(r)}</strong> über ${pairs.length} gemeinsame Wochen: ${assistantCorrText(r)}.<br>${dir}`);
  return {html,kind:"correlation",
    chart:{kind:"scatter",pairs,xLabel:`${mA.label}`,yLabel:`${mB.label}`,xtype:mA.type,ytype:mB.type},
    tableRows:pairs.map(p=>({"KW":"KW"+String(p.week).padStart(2,"0"),[mA.label]:p.x,[mB.label]:p.y})),
    tableCols:[["KW","text"],[mA.label,mA.type],[mB.label,mB.type]]};
}
function scatterChart(id,pairs,opt={}){
  const host=document.getElementById(id);if(!host)return;host.innerHTML="";
  if(!pairs||pairs.length<2){host.innerHTML='<div class="empty">Zu wenige gemeinsame Wochen für ein Streudiagramm.</div>';return;}
  const W=900,H=340,m={l:70,r:22,t:20,b:54},pw=W-m.l-m.r,ph=H-m.t-m.b;
  const xs=pairs.map(p=>p.x),ys=pairs.map(p=>p.y);
  let xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
  if(xmin===xmax){xmin-=1;xmax+=1;}if(ymin===ymax){ymin-=1;ymax+=1;}
  xmin-=(xmax-xmin)*.06;xmax+=(xmax-xmin)*.06;ymin-=(ymax-ymin)*.08;ymax+=(ymax-ymin)*.08;
  const X=v=>m.l+(v-xmin)/(xmax-xmin)*pw,Y=v=>m.t+(ymax-v)/(ymax-ymin)*ph;
  const svg=svgEl("svg",{viewBox:`0 0 ${W} ${H}`});
  for(let i=0;i<=4;i++){
    const gy=m.t+i*ph/4,val=ymax-i*(ymax-ymin)/4;
    svg.append(svgEl("line",{x1:m.l,y1:gy,x2:W-m.r,y2:gy,stroke:"#e5ebf1"}));
    svg.append(svgEl("text",{x:m.l-8,y:gy+4,"text-anchor":"end",fill:"#718096","font-size":11},fmtNum.format(val)));
  }
  for(let i=0;i<=4;i++){
    const gx=m.l+i*pw/4,val=xmin+i*(xmax-xmin)/4;
    svg.append(svgEl("text",{x:gx,y:H-22,"text-anchor":"middle",fill:"#718096","font-size":11},fmtNum.format(val)));
  }
  const N=pairs.length,mx=xs.reduce((a,b)=>a+b,0)/N,my=ys.reduce((a,b)=>a+b,0)/N;
  let num=0,den=0;pairs.forEach(p=>{num+=(p.x-mx)*(p.y-my);den+=(p.x-mx)**2;});
  const slope=den?num/den:0,intercept=my-slope*mx;
  svg.append(svgEl("line",{x1:X(xmin),y1:Y(intercept+slope*xmin),x2:X(xmax),y2:Y(intercept+slope*xmax),stroke:"#a27a4f","stroke-width":2,"stroke-dasharray":"6 5"}));
  pairs.forEach(p=>{
    const c=svgEl("circle",{cx:X(p.x),cy:Y(p.y),r:5,fill:"#76b737",stroke:"#fff","stroke-width":1.5,tabindex:0});
    c.addEventListener("mousemove",e=>showTip(e,`KW${String(p.week).padStart(2,"0")}<br>${esc(opt.xLabel||"X")}: ${fmtNum.format(p.x)}<br>${esc(opt.yLabel||"Y")}: ${fmtNum.format(p.y)}`));
    c.addEventListener("mouseleave",hideTip);svg.append(c);
  });
  svg.append(svgEl("text",{x:m.l+pw/2,y:H-4,"text-anchor":"middle",fill:"#3c4a37","font-size":12,"font-weight":700},opt.xLabel||""));
  host.append(svg);
  const legend=document.createElement("div");legend.className="legend";
  legend.innerHTML=`<div class="legend-item"><span class="legend-swatch" style="background:#76b737"></span>${esc(opt.yLabel||"Y")} über ${esc(opt.xLabel||"X")}</div>`+
    `<div class="legend-item"><span class="legend-swatch" style="background:#a27a4f"></span>Trendlinie (lineare Regression)</div>`;
  host.append(legend);
}
function answerAssistant(raw){
  const nq=normalizeDashboardQuestion(raw);
  if(assistantIsCorrelation(nq)){
    const ms=assistantMatchMetrics(nq);
    if(ms.length>=2)return assistantCorrelationAnswer(ms[0],ms[1]);
    return {html:"Für einen Zusammenhang bitte zwei Kennzahlen nennen, z. B. „Zusammenhang zwischen Ø-Preis und Umsatzmenge“ oder „Ausbeute vs Störzeit“.",kind:"info",warn:true};
  }
  const country=detectQuestionCountry(nq);
  if(extractQuestionWeek(raw)===null&&isAggregateQuestion(nq)){
    const agg=buildAggregateAnswer(nq,country);
    if(agg)return {html:agg.html,kind:"aggregate"};
  }
  const topic=detectDashboardQuestionTopic(nq,country);
  const resolution=resolveQuestionWeek(extractQuestionWeek(raw),topic.kind);
  if(resolution.selected!==null){
    return {html:topic.answer(resolution,nq,country),kind:"lookup"};
  }
  return {html:"Dazu liegen keine Werte vor. Formuliere die Frage mit einem Begriff wie Umsatz, Produktion, Auftragsbestand, Sägelinie, Störzeit, Land oder als Zusammenhang zweier Kennzahlen.",kind:"info",warn:true};
}
let assistantHistory=[];
const ASSIST_HISTORY_KEY="kwDashboardAssistantHistoryV1";
function loadAssistantHistory(){try{const s=JSON.parse(storageGet(ASSIST_HISTORY_KEY)||"[]");if(Array.isArray(s))assistantHistory=s.slice(0,20);}catch(e){}}
function saveAssistantHistory(){storageSet(ASSIST_HISTORY_KEY,JSON.stringify(assistantHistory.slice(0,20)));}
function assistantExamplesList(){
  return [
    "Wie viel Störzeit ist auf der Sägelinie im Jahr aufgelaufen?",
    "Umsatz im Jahr",
    "Zusammenhang zwischen Ausbeute und Störzeit",
    "Zusammenhang zwischen Ø-Preis und Umsatzmenge",
    "Frankreich Umsatz gesamt",
    "Auftragsbestand KW28"
  ];
}
function renderAssistantHistory(){
  if(!document.getElementById("assistantHistoryBox"))return;
  assistantHistoryBox.innerHTML=assistantHistory.length
    ?`<div class="assistant-history-title">Zuletzt gefragt</div>`+assistantHistory.slice(0,12).map(q=>`<button type="button" class="assistant-hist" data-q="${esc(q)}">${esc(q)}</button>`).join("")
    :"";
  assistantHistoryBox.querySelectorAll(".assistant-hist").forEach(btn=>btn.addEventListener("click",()=>{assistantInput.value=btn.dataset.q;runAssistant(btn.dataset.q);}));
}
function renderAssistantStatic(){
  if(!document.getElementById("assistantExamples"))return;
  assistantScope.textContent=`${availableDashboardWeeks().length} Wochenberichte · ${availableSawlineWeeks().length} Sägelinien-Wochen`;
  assistantExamples.innerHTML=assistantExamplesList().map(q=>`<button type="button" class="assistant-example" data-q="${esc(q)}">${esc(q)}</button>`).join("");
  assistantExamples.querySelectorAll(".assistant-example").forEach(btn=>btn.addEventListener("click",()=>{assistantInput.value=btn.dataset.q;runAssistant(btn.dataset.q);}));
  renderAssistantHistory();
}
function runAssistant(raw){
  if(!document.getElementById("assistantResult"))return;
  const q=String(raw||"").trim();
  if(!q){assistantResult.innerHTML='<div class="assistant-card"><div class="assistant-a warn">Bitte eine Frage eingeben.</div></div>';return;}
  const res=answerAssistant(q);
  assistantHistory=[q,...assistantHistory.filter(item=>item!==q)].slice(0,20);
  saveAssistantHistory();
  let html=`<div class="assistant-card"><div class="assistant-q">Frage: ${esc(q)}</div><div class="assistant-a${res.warn?" warn":""}">${res.html}</div>`;
  if(res.chart)html+=`<div class="assistant-chart"><div class="chart" id="assistantChart"></div></div>`;
  if(res.tableRows&&res.tableRows.length)html+=`<div class="table-wrap"><table id="assistantTable"></table></div>`;
  html+=`</div>`;
  assistantResult.innerHTML=html;
  if(res.chart&&res.chart.kind==="scatter")scatterChart("assistantChart",res.chart.pairs,{xLabel:res.chart.xLabel,yLabel:res.chart.yLabel});
  if(res.tableRows&&res.tableRows.length)renderTable("assistantTable",res.tableRows,res.tableCols);
  renderAssistantHistory();
}
function initAssistant(){
  if(!document.getElementById("assistantInput"))return;
  loadAssistantHistory();
  assistantBtn.addEventListener("click",()=>runAssistant(assistantInput.value));
  assistantInput.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();runAssistant(assistantInput.value);}});
  renderAssistantStatic();
}

function initControls(){
  loadTabOrder();
  bindTabSorting();
  const weeks=DATA.weekly.map(r=>r["KW Nr."]);
  populateGlobalWeekScroller(Math.max(...weeks));
  displayWeek.addEventListener("change",()=>setGlobalDisplayWeek(Number(displayWeek.value)));
  const displayYearSel=document.getElementById("displayYear");
  if(displayYearSel)displayYearSel.addEventListener("change",()=>setGlobalDisplayYear(displayYearSel.value));
  const displayWindowSel=document.getElementById("displayWindow");
  if(displayWindowSel){
    const stored=storageGet(WINDOW_STORAGE_KEY);
    if(stored&&WINDOW_LABELS[stored])dashboardWindow=stored;
    displayWindowSel.value=dashboardWindow;
    displayWindowSel.addEventListener("change",()=>setGlobalDisplayWindow(displayWindowSel.value));
  }
  previousWeekBtn.addEventListener("click",()=>stepGlobalDisplayWeek(-1));
  nextWeekBtn.addEventListener("click",()=>stepGlobalDisplayWeek(1));
  weekScroller.addEventListener("wheel",event=>{
    event.preventDefault();
    weekScroller.classList.add("scrolling");
    clearTimeout(window.__weekScrollClassTimer);
    window.__weekScrollClassTimer=setTimeout(()=>weekScroller.classList.remove("scrolling"),180);
    stepGlobalDisplayWeek(event.deltaY>0?1:-1);
  },{passive:false});
  document.addEventListener("keydown",event=>{
    if(!event.altKey)return;
    if(event.key==="ArrowLeft"){event.preventDefault();stepGlobalDisplayWeek(-1)}
    if(event.key==="ArrowRight"){event.preventDefault();stepGlobalDisplayWeek(1)}
  });
  let weekSwipeStartX=null;
  weekScroller.addEventListener("pointerdown",event=>{
    if(event.pointerType==="touch")weekSwipeStartX=event.clientX;
  });
  weekScroller.addEventListener("pointerup",event=>{
    if(weekSwipeStartX===null)return;
    const delta=event.clientX-weekSwipeStartX;
    weekSwipeStartX=null;
    if(Math.abs(delta)>35)stepGlobalDisplayWeek(delta<0?1:-1);
  });
  for(const id of ["weekFrom","weekTo"]){
    const el=document.getElementById(id);
    weeks.forEach(w=>el.insertAdjacentHTML("beforeend",`<option value="${w}">KW${w}</option>`));
  }
  weekFrom.value=Math.min(...weeks);weekTo.value=Math.max(...weeks);
  ["ytdWeek","refinementWeek"].forEach(id=>{
    const el=document.getElementById(id);
    weeks.forEach(w=>el.insertAdjacentHTML("beforeend",`<option value="${w}">KW${w}</option>`));
    el.value=Math.max(...weeks);
    el.addEventListener("change",renderOverviewCharts);
  });
  [salesWeek,productionWeek,countryCompareWeek].forEach(el=>{
    weeks.forEach(w=>el.insertAdjacentHTML("beforeend",`<option value="${w}">KW${String(w).padStart(2,"0")}</option>`));
    el.value=Math.max(...weeks);
  });
  salesWeek.addEventListener("change",renderSales);
  productionWeek.addEventListener("change",renderProduction);
  landEndWeek.addEventListener("change",renderLand);
  countryCompareWeek.addEventListener("change",renderCountryComparison);
  const comparisonCountries=[...new Set((DATA.countryComparison||[]).map(row=>row.Land))];
  countryCompareCountry.innerHTML=comparisonCountries.map(country=>`<option value="${esc(country)}">${esc(country)}</option>`).join("");
  countryCompareCountry.value=comparisonCountries.includes("FRANKREICH")?"FRANKREICH":comparisonCountries[0]||"";
  countryCompareCountry.addEventListener("change",renderCountryComparison);
  const salesCategories=[...new Set(DATA.salesBreakdown.map(row=>row.Kategorie))];
  salesCategory.innerHTML=salesCategories.map(category=>`<option value="${esc(category)}">${esc(category)}</option>`).join("");
  salesCategory.value=salesCategories[0]||"";
  salesCategory.addEventListener("change",renderSales);
  const productionCategories=[...new Set(DATA.productionCurrent.map(row=>row.Kennzahl))];
  productionMetric.innerHTML=productionCategories.map(category=>`<option value="${esc(category)}">${esc(category)}</option>`).join("");
  productionMetric.value="Gesamt Fm";
  productionMetric.addEventListener("change",renderProduction);
  rebuildSawlineSelectors();
  initStatisticsBoard(weeks);
  initComparison();
  initWallboard();
  const einkaufUploadBtn=document.getElementById("einkaufUploadBtn"),einkaufUpload=document.getElementById("einkaufUpload");
  if(einkaufUploadBtn&&einkaufUpload){
    einkaufUploadBtn.addEventListener("click",()=>einkaufUpload.click());
    einkaufUpload.addEventListener("change",event=>{if(event.target.files&&event.target.files[0])importEinkaufFile(event.target.files[0]);});
  }
  sawlineWeek.addEventListener("change",renderSawline);
  sawlineMetric.addEventListener("change",renderSawline);
  sawlinePrevBtn.addEventListener("click",()=>stepSawlineWeek(-1));
  sawlineNextBtn.addEventListener("click",()=>stepSawlineWeek(1));
  sawlineWeek.addEventListener("wheel",event=>{
    event.preventDefault();stepSawlineWeek(event.deltaY>0?1:-1);
  },{passive:false});
  sawlineUploadBtn.addEventListener("click",()=>{
    pendingLocalUploadKind="sawline";
    excelUpload.click();
  });
  weekFrom.addEventListener("change",()=>{if(+weekFrom.value>+weekTo.value)weekTo.value=weekFrom.value;updateAll()});
  weekTo.addEventListener("change",()=>{if(+weekTo.value<+weekFrom.value)weekFrom.value=weekTo.value;updateAll()});
  document.querySelectorAll("#nav button").forEach(btn=>btn.addEventListener("click",event=>{
    if(suppressNextTabClick){
      event.preventDefault();event.stopPropagation();return;
    }
    activateDashboardTab(btn);
  }));
  monitorCols.value=storageGet("kwDashboardMonitorCols")||"2";
  document.documentElement.style.setProperty("--monitor-cols",monitorCols.value);
  monitorCols.addEventListener("change",()=>{
    document.documentElement.style.setProperty("--monitor-cols",monitorCols.value);
    storageSet("kwDashboardMonitorCols",monitorCols.value);
  });
  fullscreenBtn.addEventListener("click",async()=>{
    try{
      if(!document.fullscreenElement)await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    }catch(e){console.warn("Vollbild konnte nicht aktiviert werden",e)}
  });
  landMetricSelect.addEventListener("change",renderLand);
  landDisplayMode.addEventListener("change",renderLand);
  const areas=[...new Set(DATA.issues.map(x=>x.Bereich))].sort();
  areaFilter.innerHTML+=areas.map(a=>`<option>${esc(a)}</option>`).join("");
  ["priorityFilter","areaFilter","issueSearch"].forEach(id=>document.getElementById(id).addEventListener("input",renderIssues));
  csvBtn.addEventListener("click",downloadCSV);
  const pdfBtn=document.getElementById("pdfBtn");
  if(pdfBtn)pdfBtn.addEventListener("click",exportDashboardPdf);
  initQuestionToggle();
  dashboardQuestionBtn.addEventListener("click",processDashboardQuestion);
  dashboardQuestionInput.addEventListener("keydown",event=>{
    if(event.key==="Enter"){
      event.preventDefault();
      processDashboardQuestion();
    }
    if(event.key==="Escape"){
      clearDashboardQuestionMarks();
      dashboardQuestionResult.className="dashboard-question-result";
      dashboardQuestionInput.value="";
    }
  });
  uploadBtn.addEventListener("click",()=>{
    pendingLocalUploadKind="weekly";
    excelUpload.click();
  });
  excelUpload.addEventListener("change",event=>importExcelFiles(event.target.files,{
    expectedKind:pendingLocalUploadKind,
    source:pendingLocalUploadKind==="sawline"?"Sägelinien-Upload":
      pendingLocalUploadKind==="weekly"?"Wochenbericht-Upload":"lokaler Upload"
  }));
  sharepointBtn.addEventListener("click",()=>{
    sharepointUrl.value=storageGet(SHAREPOINT_LAST_URL_KEY)||DEFAULT_SHAREPOINT_URL;
    setSharePointMessage("Der hinterlegte Link öffnet den SharePoint-Ordner. Für den automatischen Import kann anschließend der Link der konkreten Excel-Datei eingefügt werden.");
    if(typeof sharepointDialog.showModal==="function")sharepointDialog.showModal();
    else sharepointDialog.setAttribute("open","");
    setTimeout(()=>sharepointUrl.focus(),50);
  });
  sharepointImportBtn.addEventListener("click",importFromSharePoint);
  sharepointUrl.addEventListener("keydown",event=>{
    if(event.key==="Enter"){event.preventDefault();importFromSharePoint()}
  });
  openSharepointBtn.addEventListener("click",()=>{
    try{window.open(validateSharePointUrl(sharepointUrl.value).toString(),"_blank","noopener")}
    catch(error){setSharePointMessage(error.message,"error")}
  });
  sharepointLocalFallbackBtn.addEventListener("click",()=>{
    sharepointDialog.close();
    pendingLocalUploadKind="auto";
    excelUpload.click();
  });
  resetImportsBtn.addEventListener("click",deleteAllUploads);
  resetWindowsBtn.addEventListener("click",resetStandardWindows);
  resetTabsBtn.addEventListener("click",resetTabOrder);
  dataInfoBtn.addEventListener("click",()=>{
    if(typeof dataInfoDialog.showModal==="function")dataInfoDialog.showModal();
    else dataInfoDialog.setAttribute("open","");
  });
  [dataInfoCloseBtn,dataInfoConfirmBtn].forEach(button=>button.addEventListener("click",()=>{
    if(typeof dataInfoDialog.close==="function")dataInfoDialog.close();
    else dataInfoDialog.removeAttribute("open");
  }));
  dataInfoDialog.addEventListener("click",event=>{
    const rect=dataInfoDialog.getBoundingClientRect();
    const outside=event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom;
    if(outside&&typeof dataInfoDialog.close==="function")dataInfoDialog.close();
  });
  document.addEventListener("dragover",event=>{
    if(Array.from(event.dataTransfer?.items||[]).some(item=>item.kind==="file")){
      event.preventDefault();document.body.classList.add("file-drag");
    }
  });
  document.addEventListener("dragleave",event=>{
    if(event.relatedTarget===null)document.body.classList.remove("file-drag");
  });
  document.addEventListener("drop",event=>{
    event.preventDefault();document.body.classList.remove("file-drag");
    importExcelFiles(event.dataTransfer?.files,{expectedKind:"auto",source:"Drag-and-drop"});
  });
  initCountryPoints();
  initAssistant();
  initHistory();
  initWorldMap();
  initKpiBuilder(availableAllKpiWeeks());
  setGlobalDisplayWeek(Math.max(...weeks),{showHint:false});
  activateFirstOrderedTab();
}

const kpiWeekSelection={};

/* ---------- Globales Zeitfenster (Kopf: „Zeitraum") ----------
   current = nur die (aktuellste/gewählte) KW; 4/13/26 = die letzten N Wochen
   bis zur Anker-KW; ytd = alle Wochen bis zur Anker-KW. Gilt für die
   Wertreiter Übersicht, Umsatz, Einkauf, Produktion und Sägelinie. */
const WINDOW_STORAGE_KEY="kwDashboardWindow";
let dashboardWindow="current";
const WINDOW_LABELS={current:"Aktuellste KW","4":"4 Wochen","13":"3 Monate","26":"6 Monate",ytd:"YTD"};
function dashboardWindowLabel(){return WINDOW_LABELS[dashboardWindow]||"Aktuellste KW";}
function windowIsSumType(type){return !["price","pricefm","percent","pctpoint"].includes(type);}
/* Wochen des aktiven Fensters, verankert an endWeek (Standard: aktuellste KW). */
function dashboardWindowWeeks(endWeek,availableWeeks){
  const all=(availableWeeks&&availableWeeks.length?availableWeeks:availableDashboardWeeks()).slice().sort((a,b)=>a-b);
  if(!all.length)return [];
  const anchor=(endWeek!=null&&all.includes(Number(endWeek)))?Number(endWeek):Math.max(...all);
  const upTo=all.filter(w=>w<=anchor);
  if(dashboardWindow==="current")return upTo.slice(-1);
  if(dashboardWindow==="ytd")return upTo;
  const count=Number(dashboardWindow)||1;
  return upTo.slice(-count);
}
function windowScopeText(weeks){
  if(!weeks||!weeks.length)return "keine Woche";
  if(weeks.length===1)return `KW${weeks[0]}`;
  return `KW${weeks[0]}–KW${weeks[weeks.length-1]} · ${weeks.length} Wochen`;
}
function windowAggregate(values,type){
  const valid=values.filter(v=>v!==null&&v!==undefined&&Number.isFinite(Number(v))).map(Number);
  if(!valid.length)return null;
  const sum=valid.reduce((a,b)=>a+b,0);
  return windowIsSumType(type)?sum:sum/valid.length;
}
/* Aggregiert ein Feld aus DATA.weekly über die Fensterwochen (Summe bzw. Ø je Typ). */
function windowWeeklyField(field,weeks,type){
  const set=new Set(weeks.map(Number));
  return windowAggregate(DATA.weekly.filter(r=>set.has(Number(r["KW Nr."]))).map(r=>n(r[field])),type);
}
/* Aggregationsart je Kennzahl: Preise/Quoten = Ø, Bestände/Lager = Endwert, sonst Summe. */
function windowAggMode(field,type){
  if(["price","pricefm","percent","pctpoint"].includes(type))return "avg";
  if(/bestand|lager/i.test(String(field)))return "last";
  return "sum";
}
function windowWeeklyFieldMode(field,weeks,mode){
  const set=new Set(weeks.map(Number));
  const rows=DATA.weekly.filter(r=>set.has(Number(r["KW Nr."]))).sort((a,b)=>a["KW Nr."]-b["KW Nr."]);
  const vals=rows.map(r=>n(r[field])).filter(v=>v!==null);
  if(!vals.length)return null;
  if(mode==="avg")return vals.reduce((a,b)=>a+b,0)/vals.length;
  if(mode==="last")return n(rows[rows.length-1][field]);
  return vals.reduce((a,b)=>a+b,0);
}
const WINDOW_TAG={sum:"Σ",avg:"Ø",last:"Stand"};
const WINDOW_TAG_TITLE={sum:"Summe über den Zeitraum",avg:"Durchschnitt über den Zeitraum",last:"Bestand am Ende des Zeitraums"};
function setGlobalDisplayWindow(value){
  dashboardWindow=WINDOW_LABELS[value]?value:"current";
  storageSet(WINDOW_STORAGE_KEY,dashboardWindow);
  updateAll();
}


let dashboardDisplayYear=null;   // aktuell im Header gewähltes Jahr (alle Fenster)
function weeklyYearOf(row){
  if(row.Jahr!==undefined&&row.Jahr!==null&&row.Jahr!=="")return Number(row.Jahr);
  const m=String(row.Quelldatei||"").match(/(20\d{2})/);
  return m?Number(m[1]):2026;
}
function weeklyYears(){
  // Jahre aus dem Mehrjahres-Speicher (alle hochgeladenen Jahre), Fallback: Arbeits-Array.
  const src=(DATA.weeklyHistory&&DATA.weeklyHistory.length)?DATA.weeklyHistory:(DATA.weekly||[]);
  return [...new Set(src.map(weeklyYearOf).filter(Number.isFinite))].sort((a,b)=>a-b);
}
function purchasingYears(){
  return [...new Set((DATA.purchasingHistory||[]).map(row=>Number(row.year)).filter(Number.isFinite))].sort((a,b)=>a-b);
}
/* Jahre für den Kopf-Jahresauswähler: Wochenberichte UND Einkaufsstammdaten. */
function dashboardYears(){
  return [...new Set([...weeklyYears(),...purchasingYears()])].sort((a,b)=>a-b);
}
function activeDashboardYear(){
  const years=dashboardYears();
  if(dashboardDisplayYear!=null&&years.includes(dashboardDisplayYear))return dashboardDisplayYear;
  return years.length?years[years.length-1]:2026;
}
function availableDashboardWeeks(){
  const year=activeDashboardYear();
  return [...new Set(DATA.weekly.filter(row=>weeklyYearOf(row)===year).map(row=>Number(row["KW Nr."])).filter(Number.isFinite))].sort((a,b)=>a-b);
}
function availableAllKpiWeeks(){
  return [...new Set([
    ...availableDashboardWeeks(),
    ...DATA.sawlineReports.map(row=>Number(row["KW Nr."])).filter(Number.isFinite)
  ])].sort((a,b)=>a-b);
}
function availableWeeksForKpiDefinition(definition){
  if(!definition||typeof definition.series!=="function")return availableDashboardWeeks();
  try{
    const weeks=[...new Set(definition.series()
      .map(point=>Number(point.week))
      .filter(Number.isFinite))].sort((a,b)=>a-b);
    return weeks.length?weeks:availableDashboardWeeks();
  }catch(error){
    return availableDashboardWeeks();
  }
}
function resolveKpiWeek(definition,requestedWeek){
  const weeks=availableWeeksForKpiDefinition(definition);
  if(!weeks.length)return Number(requestedWeek)||null;
  const requested=Number(requestedWeek);
  if(weeks.includes(requested))return requested;
  const prior=weeks.filter(week=>week<=requested);
  return prior.length?Math.max(...prior):Math.max(...weeks);
}
function updateWeekScrollerState(){
  if(!document.getElementById("displayWeek"))return;
  const weeks=availableDashboardWeeks(),current=Number(displayWeek.value);
  const index=weeks.indexOf(current);
  previousWeekBtn.disabled=index<=0;
  nextWeekBtn.disabled=index<0||index>=weeks.length-1;
}
function showWeekScrollHint(week){
  if(!document.getElementById("weekScrollHint"))return;
  weekScrollHint.textContent=`Alle Anzeigen auf KW${week} aktualisiert`;
  weekScrollHint.classList.add("visible");
  clearTimeout(window.__weekHintTimer);
  window.__weekHintTimer=setTimeout(()=>weekScrollHint.classList.remove("visible"),1250);
}
function setGlobalDisplayWeek(week,{showHint=true}={}){
  const targetWeek=Number(week),weeks=availableDashboardWeeks();
  if(!weeks.includes(targetWeek))return;
  displayWeek.value=String(targetWeek);
  synchronizeAllDashboardWindows(targetWeek);
  updateWeekScrollerState();
  updateAll();
  if(showHint)showWeekScrollHint(targetWeek);
}
function stepGlobalDisplayWeek(direction){
  const weeks=availableDashboardWeeks();
  const current=Number(displayWeek.value);
  let index=weeks.indexOf(current);
  if(index<0)index=weeks.length-1;
  const nextIndex=Math.max(0,Math.min(weeks.length-1,index+direction));
  if(nextIndex!==index)setGlobalDisplayWeek(weeks[nextIndex]);
}
function populateGlobalYearSelector(){
  const sel=document.getElementById("displayYear");
  if(!sel)return;
  const years=dashboardYears();
  const active=activeDashboardYear();
  sel.innerHTML=years.map(y=>`<option value="${y}">${y}</option>`).join("");
  sel.value=String(active);
  // Bei nur einem Jahr trotzdem sichtbar lassen (Auswahl zeigt das Jahr an)
}
function populateGlobalWeekScroller(preferredWeek=null){
  if(!document.getElementById("displayWeek"))return;
  populateGlobalYearSelector();
  const weeks=availableDashboardWeeks();
  const current=preferredWeek??Number(displayWeek.value);
  displayWeek.innerHTML=weeks.map(week=>`<option value="${week}">KW${week}</option>`).join("");
  displayWeek.value=String(weeks.includes(current)?current:Math.max(...weeks));
  updateWeekScrollerState();
}
function setGlobalDisplayYear(year){
  const years=dashboardYears();
  const y=Number(year);
  if(!years.includes(y))return;
  projectDashboardYear(y);   // alle Fenster auf das gewählte Jahr umstellen
  refreshStatisticsAfterDataChange();
  const weeks=availableDashboardWeeks();
  const target=weeks.length?Math.max(...weeks):null;
  populateGlobalWeekScroller(target);
  if(target!=null)setGlobalDisplayWeek(target,{showHint:false});
  else updateAll();
}

function synchronizeAllDashboardWindows(week){
  const targetWeek=Number(week);
  if(!DATA.weekly.some(row=>row["KW Nr."]===targetWeek))return;
  if(document.getElementById("displayWeek")&&Array.from(displayWeek.options).some(option=>Number(option.value)===targetWeek)){
    displayWeek.value=String(targetWeek);
  }

  for(let index=0;index<8;index++)kpiWeekSelection[index]=targetWeek;

  [ytdWeek,refinementWeek,salesWeek,productionWeek,countryCompareWeek,sawlineWeek,statisticsBuilderWeek,builderWeek,typeof worldMapWeek!=="undefined"?worldMapWeek:null,typeof cpWeek!=="undefined"?cpWeek:null].forEach(select=>{
    if(select&&Array.from(select.options).some(option=>Number(option.value)===targetWeek)){
      select.value=String(targetWeek);
    }
  });

  customKpis.forEach(item=>item.week=targetWeek);
  statisticsModules.forEach(item=>item.endWeek=targetWeek);
  if(customKpis.length)saveKpiLayout();
  if(statisticsModules.length)saveStatisticsLayout();
}

function kpiCard(index,label,value,type,delta,vsAvg,selectedWeek){
  const options=DATA.weekly.map(r=>`<option value="${r["KW Nr."]}" ${r["KW Nr."]===selectedWeek?"selected":""}>${esc(r.KW)}</option>`).join("");
  const deltaText=delta===null?"keine Vorwoche":`${trendArrow(delta)} ${format(delta,"percent")} zur Vorwoche`;
  return `<div class="kpi">
    <div class="kpi-head">
      <div class="kpi-label">${esc(label)}</div>
      <select class="kpi-week-select" data-kpi-index="${index}" aria-label="Kalenderwoche für ${esc(label)} auswählen">${options}</select>
    </div>
    <div class="kpi-value">${format(value,type)}</div>
    <div class="kpi-meta">
      <span class="delta ${deltaClass(delta)}">${deltaText}</span>
      <span>${vsAvg===null?"":"vs Zeitraum-Ø "+(vsAvg>=0?"+":"")+format(vsAvg,"percent")}</span>
    </div>
  </div>`;
}

function detailKpi(label,value,type,meta=""){
  return `<div class="detail-kpi"><div class="detail-kpi-label">${esc(label)}</div>
    <div class="detail-kpi-value">${format(value,type)}</div>
    <div class="detail-kpi-meta">${esc(meta)}</div></div>`;
}
function salesRowsForWeek(week){
  return DATA.salesBreakdown.filter(row=>row["KW Nr."]===Number(week));
}
function productionRowsForWeek(week){
  return DATA.productionCurrent.filter(row=>row["KW Nr."]===Number(week));
}

function availableSawlineWeeks(){
  return [...new Set(DATA.sawlineReports.map(row=>Number(row["KW Nr."])).filter(Number.isFinite))].sort((a,b)=>a-b);
}
function rebuildSawlineSelectors(preferredWeek=null){
  if(!document.getElementById("sawlineWeek"))return;
  const weeks=availableSawlineWeeks();
  const current=preferredWeek??Number(sawlineWeek.value);
  sawlineWeek.innerHTML=weeks.map(week=>`<option value="${week}">KW${week}</option>`).join("");
  if(weeks.length)sawlineWeek.value=String(weeks.includes(current)?current:Math.max(...weeks));
  const metrics=[...new Map(DATA.sawlineReports.map(row=>[row.KPI,row])).values()];
  const previousMetric=sawlineMetric.value;
  sawlineMetric.innerHTML=metrics.map(row=>`<option value="${esc(row.KPI)}">${esc(row.KPI)}</option>`).join("");
  if(metrics.some(row=>row.KPI===previousMetric))sawlineMetric.value=previousMetric;
  updateSawlineStepButtons();
}
function updateSawlineStepButtons(){
  if(!document.getElementById("sawlineWeek"))return;
  const weeks=availableSawlineWeeks(),index=weeks.indexOf(Number(sawlineWeek.value));
  sawlinePrevBtn.disabled=index<=0;
  sawlineNextBtn.disabled=index<0||index>=weeks.length-1;
}
function stepSawlineWeek(direction){
  const weeks=availableSawlineWeeks(),index=weeks.indexOf(Number(sawlineWeek.value));
  if(index<0)return;
  const next=Math.max(0,Math.min(weeks.length-1,index+direction));
  if(next!==index){sawlineWeek.value=String(weeks[next]);renderSawline()}
}
function sawlineRowsForWeek(week){
  return DATA.sawlineReports.filter(row=>row["KW Nr."]===Number(week)).sort((a,b)=>a.Zeile-b.Zeile);
}
function sawlineValue(row,value){
  return format(value,row?.Werttyp||"number");
}
function renderSawlineTable(rows){
  const columns=["KPI","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Summe"];
  sawlineTable.className="sawline-table";
  sawlineTable.innerHTML=`<thead><tr>${columns.map(column=>`<th>${column}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(row=>`<tr>
      <td>${esc(row.KPI)}</td>
      ${columns.slice(1).map(column=>`<td class="num">${sawlineValue(row,row[column])}</td>`).join("")}
    </tr>`).join("")}</tbody>`;
}
function renderSawline(){
  if(!document.getElementById("sawlineWeek"))return;
  const endWeek=Number(sawlineWeek.value);
  const sawWeeks=availableSawlineWeeks();
  const weeks=dashboardWindowWeeks(endWeek,sawWeeks);
  const windowed=weeks.length>1;
  const set=new Set(weeks.map(Number));
  updateSawlineStepButtons();
  const inWindow=DATA.sawlineReports.filter(row=>set.has(Number(row["KW Nr."])));
  if(!inWindow.length){
    sawlineKpis.innerHTML='<div class="notice">Für den gewählten Zeitraum wurden keine Sägelinien-Produktionsdaten geladen.</div>';
    sawlineDailyChart.innerHTML='<div class="empty">Keine Daten</div>';
    sawlineTrendChart.innerHTML='<div class="empty">Keine Daten</div>';
    sawlineTable.innerHTML="";
    return;
  }
  const dayPairs=[["Mo","Montag"],["Di","Dienstag"],["Mi","Mittwoch"],["Do","Donnerstag"],["Fr","Freitag"],["Sa","Samstag"]];
  const dayKeys=dayPairs.map(pair=>pair[1]);
  // Kennzahlen (Zeilen) in stabiler Reihenfolge, je KPI über die Fensterwochen aggregiert
  const kpiOrder=[...new Map(inWindow.map(row=>[row.KPI,row])).values()].sort((a,b)=>Number(a.Zeile)-Number(b.Zeile));
  const rows=kpiOrder.map(sample=>{
    const rs=inWindow.filter(row=>row.KPI===sample.KPI);
    const type=sample.Werttyp||"number";
    const agg={KPI:sample.KPI,Werttyp:type,Zeitraum:sample.Zeitraum,Quelldatei:sample.Quelldatei};
    ["Summe",...dayKeys].forEach(key=>agg[key]=windowAggregate(rs.map(row=>n(row[key])),type));
    return agg;
  });
  const scope=windowScopeText(weeks);
  if(windowed){
    sawlinePeriodChip.textContent=scope;
    sawlineSourceText.textContent=`${weeks.length} Sägelinien-Wochen aggregiert (Summen Σ · Raten Ø)`;
  }else{
    const meta=inWindow[0];
    sawlinePeriodChip.textContent=`KW${weeks[0]}${meta.Zeitraum?" · "+meta.Zeitraum:""}`;
    sawlineSourceText.textContent=`Quelle: ${meta.Quelldatei}`;
  }
  sawlineKpis.innerHTML=rows.map(row=>`<article class="sawline-kpi-card">
    <div class="sawline-kpi-title">${esc(row.KPI)}</div>
    <div class="sawline-kpi-sum">${sawlineValue(row,row.Summe)}</div>
    <div class="sawline-day-grid">${dayPairs.map(([short,key])=>`<div class="sawline-day-cell">
      <span>${short}</span><strong title="${sawlineValue(row,row[key])}">${sawlineValue(row,row[key])}</strong>
    </div>`).join("")}</div>
  </article>`).join("");
  const metric=sawlineMetric.value||rows[0].KPI;
  if(!sawlineMetric.value)sawlineMetric.value=metric;
  const selected=rows.find(row=>row.KPI===metric)||rows[0];
  sawlineDailySub.textContent=`${scope} · ${selected.KPI}${windowed?" (aggregiert)":""}`;
  barChart("sawlineDailyChart",dayPairs.map(([short,key],index)=>({
    label:short,value:n(selected[key])||0,color:colors[index%colors.length],
    formatted:sawlineValue(selected,selected[key])
  })),{tick:value=>selected.Werttyp==="pctpoint"?fmtNum.format(value):fmt0.format(value)});
  const trendRows=DATA.sawlineReports.filter(row=>row.KPI===selected.KPI&&(windowed?set.has(Number(row["KW Nr."])):true)).sort((a,b)=>a["KW Nr."]-b["KW Nr."]);
  sawlineTrendSub.textContent=`${selected.KPI} · Summe beziehungsweise Wochenwert`;
  lineChart("sawlineTrendChart",trendRows.map(row=>row.KW),[
    {name:selected.KPI,values:trendRows.map(row=>n(row.Summe)),format:value=>format(value,selected.Werttyp)}
  ],{zero:!["pctpoint","fmmin","m3min"].includes(selected.Werttyp),tick:value=>fmtNum.format(value)});
  renderSawlineTable(rows);
}

/* ---------- Plausibilitätsprüfung Verladungen ----------
   Pro Verladung können maximal 40 m³ geladen werden. Die Verladekapazität
   einer Woche ist damit Anzahl Verladungen × 40 = X. Die Umsatzmenge gesamt
   kann nicht größer sein als diese Kapazität – sonst wären je Verladung mehr
   als 40 m³ transportiert worden. Toleranz: 1 %. */
const SHIPMENT_MAX_M3=40;
const SHIPMENT_TOLERANCE=0.01;
function shipmentPlausibility(weekly){
  const verladungen=n(weekly&&weekly["Verladungen gesamt"]);
  const umsatz=n(weekly&&weekly["Umsatzmenge gesamt (m³)"]);
  if(verladungen===null||umsatz===null)return null;   // nicht prüfbar
  const x=verladungen*SHIPMENT_MAX_M3;                 // Verladekapazität
  const limit=x*(1+SHIPMENT_TOLERANCE);                // Kapazität inkl. 1 % Toleranz
  return {ok:umsatz<=limit,x,umsatz,verladungen,limit};
}
/* Plausibilität über mehrere Wochen (Summe Verladungen bzw. Umsatzmenge). */
function shipmentPlausibilityWeeks(weeks){
  const set=new Set(weeks.map(Number));
  const rows=DATA.weekly.filter(r=>set.has(Number(r["KW Nr."])));
  const verl=rows.map(r=>n(r["Verladungen gesamt"])).filter(v=>v!==null);
  const ums=rows.map(r=>n(r["Umsatzmenge gesamt (m³)"])).filter(v=>v!==null);
  if(!verl.length||!ums.length)return null;
  const verladungen=verl.reduce((a,b)=>a+b,0),umsatz=ums.reduce((a,b)=>a+b,0);
  const x=verladungen*SHIPMENT_MAX_M3,limit=x*(1+SHIPMENT_TOLERANCE);
  return {ok:umsatz<=limit,x,umsatz,verladungen,limit};
}
function renderSalesPlausibility(weeks){
  const host=document.getElementById("salesPlausibility");
  if(!host)return;
  if(!weeks.length||!(DATA.weekly&&DATA.weekly.length)){host.hidden=true;return;}
  const scope=weeks.length===1?`KW${weeks[0]}`:windowScopeText(weeks);
  const p=shipmentPlausibilityWeeks(weeks);
  if(!p){
    host.hidden=false;host.className="plausi-banner plausi-neutral";
    host.innerHTML=`<span class="plausi-icon">–</span><div class="plausi-text"><strong>Prüfung nicht möglich</strong><div class="plausi-detail">Für ${scope} fehlen Verladungen oder Umsatzmenge.</div></div>`;
    return;
  }
  host.hidden=false;
  host.className=`plausi-banner ${p.ok?"plausi-ok":"plausi-bad"}`;
  const detail=`Umsatzmenge ${format(p.umsatz,"m3")} ${p.ok?"≤":">"} Verladekapazität `+
    `(${fmt0.format(p.verladungen)} Verladungen × ${SHIPMENT_MAX_M3} m³ = ${format(p.x,"m3")}) + 1 % Toleranz (${format(p.limit,"m3")})`;
  host.innerHTML=`<span class="plausi-icon">${p.ok?"✓":"✗"}</span>`+
    `<div class="plausi-text"><strong>${p.ok?"Prüfung OK":"Prüfung NICHT OK"}</strong> · ${scope}`+
    `<div class="plausi-detail">${detail}</div></div>`;
}
function renderSales(){
  if(!document.getElementById("salesWeek"))return;
  const endWeek=Number(salesWeek.value);
  const weeks=dashboardWindowWeeks(endWeek);
  const windowed=weeks.length>1;
  renderSalesPlausibility(weeks);
  const set=new Set(weeks.map(Number));
  const cats=[...new Set(DATA.salesBreakdown.filter(row=>set.has(Number(row["KW Nr."]))).map(row=>row.Kategorie))];
  const gesamtmenge=windowWeeklyField("Umsatzmenge gesamt (m³)",weeks,"m3");
  const preis=windowWeeklyField("Ø Preis gesamt (€/m³)",weeks,"price");
  if(!cats.length){
    salesKpis.innerHTML='<div class="notice">Für den gewählten Zeitraum liegen keine Umsatzdetails vor.</div>';
    barChart("salesQtyChart",[]);barChart("salesPriceChart",[]);lineChart("salesTrendChart",[],[]);renderTable("salesTable",[],[["Kategorie","text"]]);
    return;
  }
  const rows=cats.map(cat=>{
    const rs=DATA.salesBreakdown.filter(row=>row.Kategorie===cat&&set.has(Number(row["KW Nr."])));
    return {
      Kategorie:cat,
      "Menge (m³)":windowAggregate(rs.map(row=>n(row["Menge (m³)"])),"m3"),
      "EUR (€/m³)":windowAggregate(rs.map(row=>n(row["EUR (€/m³)"])),"price"),
      "M%":windowAggregate(rs.map(row=>n(row["M%"])),"pctpoint")
    };
  });
  const scope=windowScopeText(weeks);
  const byName=name=>rows.find(row=>row.Kategorie===name);
  const main=byName("Hauptware Säge"),side=byName("NE Sägewerk");
  salesKpis.innerHTML=[
    detailKpi(windowed?"Gesamtmenge (Σ)":"Gesamtmenge",gesamtmenge,"m3",scope),
    detailKpi(windowed?"Ø Preis Gesamt (Ø)":"Ø Preis Gesamt",preis,"price",scope),
    detailKpi("Hauptware Säge · M%",main?.["M%"],"pctpoint",format(main?.["Menge (m³)"],"m3")),
    detailKpi("NE Sägewerk · M%",side?.["M%"],"pctpoint",format(side?.["Menge (m³)"],"m3"))
  ].join("");
  salesQtySub.textContent=windowed?`${scope} · Menge nach BM in m³ (Σ)`:`${scope} · Menge nach BM in m³`;
  salesPriceSub.textContent=windowed?`${scope} · Ø-Preis in €/m³`:`${scope} · Durchschnittspreis in €/m³`;
  barChart("salesQtyChart",rows.map((row,index)=>({
    label:row.Kategorie,value:n(row["Menge (m³)"])||0,color:colors[index%colors.length],
    formatted:format(row["Menge (m³)"],"m3")
  })),{tick:value=>fmt0.format(value)});
  barChart("salesPriceChart",rows.filter(row=>n(row["EUR (€/m³)"])!==null).map((row,index)=>({
    label:row.Kategorie,value:n(row["EUR (€/m³)"]),color:colors[index%colors.length],
    formatted:format(row["EUR (€/m³)"],"price")
  })),{tick:value=>fmt0.format(value)});
  const category=salesCategory.value||rows[0].Kategorie;
  const categoryRows=DATA.salesBreakdown.filter(row=>row.Kategorie===category&&(windowed?set.has(Number(row["KW Nr."])):true)).sort((a,b)=>a["KW Nr."]-b["KW Nr."]);
  const firstQty=categoryRows.find(row=>n(row["Menge (m³)"])!==null)?.["Menge (m³)"];
  const firstPrice=categoryRows.find(row=>n(row["EUR (€/m³)"])!==null)?.["EUR (€/m³)"];
  lineChart("salesTrendChart",categoryRows.map(row=>row.KW),[
    {name:"Menge · Index",values:categoryRows.map(row=>firstQty&&n(row["Menge (m³)"])!==null?n(row["Menge (m³)"])/firstQty*100:null),format:value=>fmtNum.format(value)},
    {name:"Preis · Index",values:categoryRows.map(row=>firstPrice&&n(row["EUR (€/m³)"])!==null?n(row["EUR (€/m³)"])/firstPrice*100:null),format:value=>fmtNum.format(value)}
  ],{tick:value=>fmtNum.format(value)});
  renderTable("salesTable",rows,[
    ["Kategorie","salesCategory"],["Menge (m³)","m3"],["EUR (€/m³)","price"],["M%","pctpoint"]
  ]);
}
function renderProduction(){
  if(!document.getElementById("productionWeek"))return;
  const endWeek=Number(productionWeek.value);
  const weeks=dashboardWindowWeeks(endWeek);
  const windowed=weeks.length>1;
  const set=new Set(weeks.map(Number));
  const metricsInWindow=[...new Map(DATA.productionCurrent.filter(r=>set.has(Number(r["KW Nr."]))).map(r=>[r.Kennzahl,r])).values()];
  if(!metricsInWindow.length){
    productionKpis.innerHTML='<div class="notice">Für den gewählten Zeitraum liegen keine Produktionsdetails vor.</div>';
    barChart("productionFmChart",[]);lineChart("productionTrendChart",[],[]);renderTable("productionCurrentTable",[],[["Kennzahl","text"]]);
    return;
  }
  const scope=windowScopeText(weeks);
  const agg=metricsInWindow.map(sample=>{
    const type=sample.Einheit==="m³"?"m3":"fm";
    const rs=DATA.productionCurrent.filter(r=>r.Kennzahl===sample.Kennzahl&&set.has(Number(r["KW Nr."])));
    return {Kennzahl:sample.Kennzahl,Einheit:sample.Einheit,type,value:windowAggregate(rs.map(r=>n(r.Aktuell)),type)};
  });
  productionKpis.innerHTML=agg.map(a=>detailKpi(a.Kennzahl,a.value,a.type,windowed?`${scope} · Σ`:scope)).join("");
  productionFmSub.textContent=windowed?`${scope} · Leistung in fm (Σ)`:`${scope} · aktuelle Leistung in fm`;
  barChart("productionFmChart",agg.filter(a=>a.Einheit==="fm").map((a,index)=>({
    label:a.Kennzahl,value:n(a.value)||0,color:colors[index%colors.length],formatted:format(a.value,"fm")
  })),{tick:value=>fmt0.format(value)});
  const metric=productionMetric.value||"Gesamt Fm";
  const trendRows=DATA.productionCurrent.filter(row=>row.Kennzahl===metric&&(windowed?set.has(Number(row["KW Nr."])):true)).sort((a,b)=>a["KW Nr."]-b["KW Nr."]);
  const type=trendRows[0]?.Einheit==="m³"?"m3":"fm";
  lineChart("productionTrendChart",trendRows.map(row=>row.KW),[
    {name:metric,values:trendRows.map(row=>n(row.Aktuell)),format:value=>format(value,type)}
  ],{zero:true,tick:value=>fmt0.format(value)});
  if(windowed){
    renderTable("productionCurrentTable",agg.map(a=>({Kennzahl:a.Kennzahl,Einheit:a.Einheit,"Zeitraum (Σ/Ø)":a.value})),[
      ["Kennzahl","text"],["Zeitraum (Σ/Ø)","productionValue"]
    ]);
  }else{
    const week=weeks[0],rows=productionRowsForWeek(week);
    const previousWeek=DATA.weekly.filter(row=>row["KW Nr."]<week).sort((a,b)=>b["KW Nr."]-a["KW Nr."])[0]?.["KW Nr."];
    const tableRows=rows.map(row=>{
      const previous=DATA.productionCurrent.find(item=>item["KW Nr."]===previousWeek&&item.Kennzahl===row.Kennzahl);
      const delta=previous&&n(previous.Aktuell)!==null&&n(row.Aktuell)!==null?n(row.Aktuell)-n(previous.Aktuell):null;
      const deltaPct=previous&&n(previous.Aktuell)?delta/Math.abs(n(previous.Aktuell)):null;
      return {...row,"Vorwoche":previous?.Aktuell??null,"Δ absolut":delta,"Δ %":deltaPct};
    });
    renderTable("productionCurrentTable",tableRows,[
      ["Kennzahl","text"],["Aktuell","productionValue"],["Vorwoche","productionValue"],["Δ absolut","productionDelta"],["Δ %","percent"]
    ]);
  }
}

function renderEinkauf(){
  if(!document.getElementById("einkaufKpis"))return;
  const allRows=purchasingRowsActive();
  const year=activeDashboardYear();
  const scopeChip=document.getElementById("einkaufScope");
  if(!allRows.length){
    if(scopeChip)scopeChip.textContent=`Einkauf ${year}`;
    einkaufKpis.innerHTML='<div class="notice">Für das gewählte Jahr liegen keine Einkaufsdaten vor.</div>';
    lineChart("einkaufPriceChart",[],[]);lineChart("einkaufQtyChart",[],[]);lineChart("einkaufComboChart",[],[]);
    renderTable("einkaufTable",[],[["KW","text"]]);
    return;
  }
  const purchaseWeeks=allRows.map(row=>Number(row.week));
  const weeks=dashboardWindowWeeks(null,purchaseWeeks);   // an der aktuellsten Einkaufs-KW verankert
  const windowed=weeks.length>1;
  const set=new Set(weeks.map(Number));
  const rows=allRows.filter(row=>set.has(Number(row.week)));
  const scopeText=windowScopeText(weeks);
  if(scopeChip)scopeChip.textContent=`Einkauf ${year} · ${dashboardWindowLabel()}`;
  const sum=key=>rows.reduce((total,row)=>total+(n(row[key])||0),0);
  const nettoSum=sum("netto"),fmGekauftSum=sum("fmGekauft"),fmGeliefertSum=sum("fmGeliefert");
  const avgPreis=fmGekauftSum?nettoSum/fmGekauftSum:null;
  const liefergrad=fmGekauftSum?fmGeliefertSum/fmGekauftSum:null;
  einkaufKpis.innerHTML=[
    detailKpi(windowed?"Einkaufswert netto (Σ)":"Einkaufswert netto",nettoSum,"currency",scopeText),
    detailKpi(windowed?"fm gekauft (Σ)":"fm gekauft",fmGekauftSum,"fm",scopeText),
    detailKpi(windowed?"fm geliefert (Σ)":"fm geliefert",fmGeliefertSum,"fm",scopeText),
    detailKpi("Ø Einkaufspreis",avgPreis,"pricefm","Netto ÷ fm gekauft"),
    detailKpi("Liefergrad",liefergrad,"percent","fm geliefert ÷ fm gekauft")
  ].join("");
  // Diagramme: im Fenstermodus auf die Fensterwochen begrenzt, sonst voller Jahresverlauf
  const chartRows=windowed?rows:allRows;
  const labels=chartRows.map(row=>`KW${row.week}`);
  lineChart("einkaufPriceChart",labels,[
    {name:"Ø Einkaufspreis (€/fm)",values:chartRows.map(purchasingAvgPreis),format:value=>format(value,"pricefm")}
  ],{zero:false,tick:value=>fmt2.format(value)});
  lineChart("einkaufQtyChart",labels,[
    {name:"fm gekauft",values:chartRows.map(row=>n(row.fmGekauft)),format:value=>format(value,"fm")},
    {name:"fm geliefert",values:chartRows.map(row=>n(row.fmGeliefert)),format:value=>format(value,"fm")}
  ],{zero:true,tick:value=>fmt0.format(value)});
  const comboAll=purchasingSalesSeries().filter(point=>point.umsatz!==null&&point.fmGeliefert!==null);
  const combo=windowed?comboAll.filter(point=>set.has(Number(point.week))):comboAll;
  const comboSub=document.getElementById("einkaufComboSub");
  if(!combo.length){
    lineChart("einkaufComboChart",[],[]);
    if(comboSub)comboSub.textContent=`Für den Vergleich Einkauf ↔ Umsatz müssen Wochenberichte (Umsatz) für ${year} geladen sein.`;
  }else{
    const baseU=combo[0].umsatz,baseF=combo[0].fmGeliefert;
    lineChart("einkaufComboChart",combo.map(point=>`KW${point.week}`),[
      {name:"Umsatz (Index)",values:combo.map(point=>baseU?point.umsatz/baseU*100:null),format:value=>value===null?"–":fmt0.format(value)},
      {name:"fm geliefert (Index)",values:combo.map(point=>baseF?point.fmGeliefert/baseF*100:null),format:value=>value===null?"–":fmt0.format(value)}
    ],{zero:false,tick:value=>fmt0.format(value)});
    const wSum=combo.reduce((total,point)=>total+point.umsatz,0),fSum=combo.reduce((total,point)=>total+point.fmGeliefert,0);
    if(comboSub)comboSub.textContent=`${combo.length} gemeinsame Wochen · Umsatz je fm geliefert (gewichtet) ${format(fSum?wSum/fSum:null,"pricefm")} · Linien indexiert auf die erste gemeinsame Woche = 100.`;
  }
  const tableRows=chartRows.map(row=>({
    "KW":`KW${row.week}`,"Netto (€)":n(row.netto),"fm gekauft":n(row.fmGekauft),
    "fm geliefert":n(row.fmGeliefert),"Ø Preis (€/fm)":purchasingAvgPreis(row)
  }));
  renderTable("einkaufTable",tableRows,[
    ["KW","text"],["Netto (€)","currency"],["fm gekauft","fm"],["fm geliefert","fm"],["Ø Preis (€/fm)","pricefm"]
  ]);
}

/* ---------- Einkauf-Upload (aktuellste Einkauf.xlsx) ---------- */
const PURCHASING_STORAGE_KEY="kwDashboardPurchasingV1";
function purchasingKey(row){return `${Number(row.year)}|${Number(row.week)}`;}
function mergePurchasingRecords(base,extra){
  const map=new Map();
  (base||[]).forEach(row=>map.set(purchasingKey(row),row));
  (extra||[]).forEach(row=>map.set(purchasingKey(row),row));
  return [...map.values()].sort((a,b)=>Number(a.year)-Number(b.year)||Number(a.week)-Number(b.week));
}
function applyStoredPurchasing(){
  try{
    const stored=JSON.parse(storageGet(PURCHASING_STORAGE_KEY)||"null");
    if(Array.isArray(stored)&&stored.length)DATA.purchasingHistory=mergePurchasingRecords(DATA.purchasingHistory,stored);
  }catch(error){console.warn("Gespeicherte Einkaufsdaten konnten nicht geladen werden",error);}
}
/* Label-verankerter Parser für Einkauf.xlsx: findet Kopfzeile mit „Datum" und
   je Datum-Block die Spalten Netto gekauft, fm gekauft, fm geliefert. */
function parseEinkaufWorkbook(matrix){
  const norm=v=>String(v==null?"":v).trim().toLowerCase();
  let headerRow=-1;
  for(let r=0;r<Math.min(matrix.length,20);r++){
    if((matrix[r]||[]).some(c=>norm(c)==="datum")){headerRow=r;break;}
  }
  if(headerRow<0)throw new Error("Kopfzeile mit „Datum“ nicht gefunden.");
  const header=matrix[headerRow]||[];
  const datumCols=[];
  header.forEach((c,i)=>{if(norm(c)==="datum")datumCols.push(i);});
  if(!datumCols.length)throw new Error("Spalte „Datum“ nicht gefunden.");
  const numAt=(r,c)=>{const v=matrix[r]?.[c];if(v==null||v==="")return null;const num=Number(v);return Number.isFinite(num)?num:null;};
  const records=[];
  datumCols.forEach(dc=>{
    const findCol=(pred,fallback)=>{for(let c=dc+1;c<=dc+4;c++){if(pred(norm(header[c])))return c;}return fallback;};
    const nettoCol=findCol(h=>h.includes("netto"),dc+1);
    const gekauftCol=findCol(h=>h.includes("gekauft")&&!h.includes("netto"),dc+2);
    const geliefertCol=findCol(h=>h.includes("geliefert"),dc+3);
    for(let r=headerRow+1;r<matrix.length;r++){
      const datum=matrix[r]?.[dc];
      if(datum==null)continue;
      const m=String(datum).match(/(\d{4})\s*[\/\-]\s*(\d{1,2})/);
      if(!m)continue;
      const year=Number(m[1]),week=Number(m[2]);
      if(!Number.isFinite(year)||!Number.isFinite(week)||week<1||week>53)continue;
      const netto=numAt(r,nettoCol),fmGekauft=numAt(r,gekauftCol),fmGeliefert=numAt(r,geliefertCol);
      if(netto===null&&fmGekauft===null&&fmGeliefert===null)continue;
      records.push({year,week,netto,fmGekauft,fmGeliefert});
    }
  });
  return records;
}
function setEinkaufUploadStatus(message,state=""){
  const host=document.getElementById("einkaufUploadStatus");
  if(!host)return;
  host.hidden=!message;
  host.textContent=message||"";
  host.className="einkauf-upload-status"+(state?" "+state:"");
}
async function importEinkaufFile(file){
  if(!file)return;
  if(!/\.xlsx$/i.test(file.name)){setEinkaufUploadStatus("Bitte eine .xlsx-Datei auswählen.","error");return;}
  setEinkaufUploadStatus(`„${file.name}“ wird gelesen …`,"working");
  try{
    const matrix=await readFirstWorksheet(file);
    const records=parseEinkaufWorkbook(matrix);
    if(!records.length)throw new Error("Keine Einkaufszeilen im Format „Jahr/KW“ gefunden.");
    DATA.purchasingHistory=mergePurchasingRecords(DATA.purchasingHistory,records);
    try{storageSet(PURCHASING_STORAGE_KEY,JSON.stringify(DATA.purchasingHistory));}catch(error){console.warn(error);}
    projectDashboardYear(activeDashboardYear());
    if(document.getElementById("displayWeek"))populateGlobalWeekScroller(Number(displayWeek.value));
    updateAll();
    const years=[...new Set(records.map(r=>r.year))].sort((a,b)=>a-b);
    setEinkaufUploadStatus(`${records.length} Einkaufszeile(n) aus ${years.length} Jahr(en) (${years.join(", ")}) importiert und gespeichert.`,"success");
  }catch(error){
    console.error(error);
    setEinkaufUploadStatus(`Import fehlgeschlagen: ${error.message}`,"error");
  }
  const input=document.getElementById("einkaufUpload");
  if(input)input.value="";
}

/* ---------- Großbild-Modus (zweiter Designstrang) ---------- */
let wallboardWeek=null,wbWheelTs=0;
function wallboardIsOpen(){const wb=document.getElementById("wallboard");return wb&&!wb.hidden;}
function wallboardWeeks(){return availableDashboardWeeks();}
function populateWallboardYear(){
  const sel=document.getElementById("wbYearSel");if(!sel)return;
  const years=weeklyYears().length?weeklyYears():dashboardYears();
  sel.innerHTML=years.map(y=>`<option value="${y}">${y}</option>`).join("");
  sel.value=String(activeDashboardYear());
}
function openWallboard(){
  const wb=document.getElementById("wallboard");if(!wb)return;
  const weeks=wallboardWeeks();
  wallboardWeek=weeks.length?Math.max(...weeks):null;
  populateWallboardYear();
  wb.hidden=false;wb.setAttribute("aria-hidden","false");
  document.body.style.overflow="hidden";
  renderWallboard();
}
function closeWallboard(){
  const wb=document.getElementById("wallboard");if(!wb)return;
  wb.hidden=true;wb.setAttribute("aria-hidden","true");
  document.body.style.overflow="";
}
function stepWallboard(direction){
  const weeks=wallboardWeeks();if(!weeks.length)return;
  const idx=weeks.indexOf(wallboardWeek);
  const next=Math.max(0,Math.min(weeks.length-1,(idx<0?weeks.length-1:idx)+direction));
  if(weeks[next]!==wallboardWeek){wallboardWeek=weeks[next];renderWallboard();}
}
function renderWallboard(){
  const wb=document.getElementById("wallboard");
  if(!wb||wb.hidden)return;
  const body=document.getElementById("wbBody"),strip=document.getElementById("wbStrip");
  const year=activeDashboardYear();
  document.getElementById("wbYear").textContent=String(year);
  const weeks=wallboardWeeks();
  if(!weeks.length){
    document.getElementById("wbKw").textContent="KW –";
    document.getElementById("wbPrev").disabled=true;document.getElementById("wbNext").disabled=true;
    body.innerHTML='<div class="wb-empty">Noch keine Wochenberichte geladen.<br>Bitte im normalen Dashboard oben rechts Wochenbericht-Excel (KW-XX-20XX.xlsx) hochladen.</div>';
    strip.innerHTML="";return;
  }
  if(!weeks.includes(wallboardWeek))wallboardWeek=Math.max(...weeks);
  const week=wallboardWeek;
  document.getElementById("wbKw").textContent="KW "+week;
  document.getElementById("wbPrev").disabled=weeks.indexOf(week)<=0;
  document.getElementById("wbNext").disabled=weeks.indexOf(week)>=weeks.length-1;
  const weekly=DATA.weekly.find(row=>row["KW Nr."]===week)||{};
  const prod=productionRowsForWeek(week);
  const startsWith=name=>prod.find(row=>String(row.Kennzahl||"").toLowerCase().startsWith(name));
  const gesamtFm=n(weekly["Produktion KW gesamt (fm)"]),gesamtM3=n(weekly["Produktion KW (m³)"]);
  const saege=startsWith("säge"),gatter=startsWith("gatter");
  const menge=n(weekly["Umsatzmenge gesamt (m³)"]),preis=n(weekly["Ø Preis gesamt (€/m³)"]);
  const sales=salesRowsForWeek(week)
    .filter(row=>n(row["Menge (m³)"])!==null&&!/gesamt/i.test(row.Kategorie)&&!/^davon/i.test(row.Kategorie))
    .sort((a,b)=>(n(b["Menge (m³)"])||0)-(n(a["Menge (m³)"])||0)).slice(0,8);
  const maxMenge=Math.max(1,...sales.map(row=>n(row["Menge (m³)"])||0));
  const prodSub=[
    gesamtM3!=null?`<b>${format(gesamtM3,"m3")}</b>`:null,
    saege?`Säge <b>${format(n(saege.Aktuell),"fm")}</b>`:null,
    gatter?`Gatter <b>${format(n(gatter.Aktuell),"fm")}</b>`:null
  ].filter(Boolean).join(" · ");
  body.innerHTML=`
   <div class="wb-grid">
     <section class="wb-card wb-prod">
       <div class="wb-card-label">Produktion</div>
       <div class="wb-hero"><span class="wb-hero-val">${gesamtFm==null?"–":fmt0.format(gesamtFm)}</span><span class="wb-hero-unit">fm</span></div>
       <div class="wb-sub">${prodSub||"keine Produktionsdetails für diese Woche"}</div>
     </section>
     <section class="wb-card">
       <div class="wb-card-label">Verkauf · Menge</div>
       <div class="wb-hero"><span class="wb-hero-val">${menge==null?"–":fmtNum.format(menge)}</span><span class="wb-hero-unit">m³</span></div>
       <div class="wb-sub">fakturierte Umsatzmenge</div>
     </section>
     <section class="wb-card">
       <div class="wb-card-label">Verkauf · Ø Preis</div>
       <div class="wb-hero"><span class="wb-hero-val">${preis==null?"–":fmt0.format(preis)}</span><span class="wb-hero-unit">€/m³</span></div>
       <div class="wb-sub">Durchschnittspreis gesamt</div>
     </section>
   </div>
   <section class="wb-products">
     <div class="wb-card-label">Verkaufte Ware · Menge &amp; Preis</div>
     ${sales.length?`<div class="wb-prod-list">${sales.map(row=>{
        const m=n(row["Menge (m³)"])||0,pr=n(row["EUR (€/m³)"]);
        const width=Math.max(7,Math.round(m/maxMenge*100));
        return `<div class="wb-prow">
          <div class="wb-pname" title="${esc(row.Kategorie)}">${esc(row.Kategorie)}</div>
          <div class="wb-pbar-wrap"><div class="wb-pbar" style="width:${width}%"><span>${format(m,"m3")}</span></div></div>
          <div class="wb-pprice">${pr==null?"–":format(pr,"price")}</div>
        </div>`;
     }).join("")}</div>`:`<div class="wb-empty">Für KW ${week} liegen keine Produktdaten vor.</div>`}
   </section>`;
  strip.innerHTML=weeks.map(w=>`<button class="wb-chip ${w===week?"active":""}" data-wk="${w}" type="button">KW ${w}</button>`).join("");
  strip.querySelectorAll(".wb-chip").forEach(chip=>chip.addEventListener("click",()=>{wallboardWeek=Number(chip.dataset.wk);renderWallboard();}));
  const active=strip.querySelector(".wb-chip.active");
  if(active&&active.scrollIntoView)active.scrollIntoView({inline:"center",block:"nearest"});
}
function initWallboard(){
  const btn=document.getElementById("wallboardBtn");
  if(btn)btn.addEventListener("click",openWallboard);
  const exit=document.getElementById("wbExit");if(exit)exit.addEventListener("click",closeWallboard);
  const prev=document.getElementById("wbPrev");if(prev)prev.addEventListener("click",()=>stepWallboard(-1));
  const next=document.getElementById("wbNext");if(next)next.addEventListener("click",()=>stepWallboard(1));
  const yearSel=document.getElementById("wbYearSel");
  if(yearSel)yearSel.addEventListener("change",()=>{
    setGlobalDisplayYear(yearSel.value);
    const weeks=wallboardWeeks();wallboardWeek=weeks.length?Math.max(...weeks):null;
    renderWallboard();
  });
  document.addEventListener("keydown",event=>{
    if(!wallboardIsOpen())return;
    if(event.key==="Escape")closeWallboard();
    else if(event.key==="ArrowLeft"){event.preventDefault();stepWallboard(-1);}
    else if(event.key==="ArrowRight"){event.preventDefault();stepWallboard(1);}
  });
  const wb=document.getElementById("wallboard");
  if(wb)wb.addEventListener("wheel",event=>{
    if(!wallboardIsOpen())return;
    event.preventDefault();
    const now=Date.now();if(now-wbWheelTs<170)return;wbWheelTs=now;
    stepWallboard(event.deltaY>0?1:-1);
  },{passive:false});
}

function kpiCardWindow(label,value,type,scopeText,delta,mode){
  const deltaText=delta===null?"kein Vorzeitraum":`${trendArrow(delta)} ${format(delta,"percent")} zum Vorzeitraum`;
  return `<div class="kpi">
    <div class="kpi-head">
      <div class="kpi-label">${esc(label)}</div>
      <span class="kpi-window-tag" title="${esc(WINDOW_TAG_TITLE[mode]||"")}">${esc(WINDOW_TAG[mode]||"Σ")}</span>
    </div>
    <div class="kpi-value">${format(value,type)}</div>
    <div class="kpi-meta">
      <span class="delta ${deltaClass(delta)}">${deltaText}</span>
      <span>${esc(scopeText)}</span>
    </div>
  </div>`;
}
function renderKpis(){
  if(!document.getElementById("kpis"))return;
  const defs=[
    ["Umsatzmenge","Umsatzmenge gesamt (m³)","m3"],["Ø Preis","Ø Preis gesamt (€/m³)","price"],
    ["DB Netto","DB Netto (€)","currency"],["DB je m³","DB (€/m³)","price"],
    ["Produktion","Produktion KW gesamt (fm)","fm"],["Auftragseingang","Auftragseingang gesamt (m³)","m3"],
    ["4-Wochenbestand","Auftragsbestand 4W (m³)","m3"],["Verladungen","Verladungen gesamt","number"]
  ];
  if(dashboardWindow!=="current"){
    const allWeeks=availableDashboardWeeks();
    if(!allWeeks.length){kpis.innerHTML='<div class="notice">Für den gewählten Zeitraum liegen keine Werte vor.</div>';rangeText.textContent="";latestChip.textContent="";return;}
    const weeks=dashboardWindowWeeks();
    const scope=windowScopeText(weeks);
    const before=allWeeks.filter(w=>w<weeks[0]);
    const prevWeeks=dashboardWindow==="ytd"?[]:before.slice(-weeks.length);
    kpis.innerHTML=defs.map(([label,key,type])=>{
      const mode=windowAggMode(key,type);
      const value=windowWeeklyFieldMode(key,weeks,mode);
      const prev=prevWeeks.length?windowWeeklyFieldMode(key,prevWeeks,mode):null;
      const d=(prev!==null&&value!==null)?pctDelta(prev,value):null;
      return kpiCardWindow(label,value,type,scope,d,mode);
    }).join("");
    rangeText.textContent=`Aggregierter Zeitraum: ${scope} · Mengen/Werte summiert, Preise und Quoten gemittelt`;
    latestChip.textContent=`Zeitraum: ${dashboardWindowLabel()}`;
    return;
  }
  const periodRows=selectedWeekly();if(!periodRows.length)return;
  const periodEnd=periodRows[periodRows.length-1];
  kpis.innerHTML=defs.map(([label,key,type],index)=>{
    if(kpiWeekSelection[index]===undefined)kpiWeekSelection[index]=periodEnd["KW Nr."];
    const selectedWeek=kpiWeekSelection[index];
    const selectedIndex=DATA.weekly.findIndex(r=>r["KW Nr."]===selectedWeek);
    const selectedRow=DATA.weekly[selectedIndex]||periodEnd;
    const previousRow=selectedIndex>0?DATA.weekly[selectedIndex-1]:null;
    const vals=periodRows.map(r=>n(r[key])).filter(v=>v!==null);
    const avg=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;
    const d=previousRow?pctDelta(n(previousRow[key]),n(selectedRow[key])):null;
    const va=avg&&n(selectedRow[key])!==null?((n(selectedRow[key])-avg)/Math.abs(avg)):null;
    return kpiCard(index,label,n(selectedRow[key]),type,d,va,selectedRow["KW Nr."])
  }).join("");
  document.querySelectorAll(".kpi-week-select").forEach(el=>el.addEventListener("change",e=>{
    kpiWeekSelection[Number(e.currentTarget.dataset.kpiIndex)]=Number(e.currentTarget.value);
    renderKpis();
  }));
  rangeText.textContent=`Diagramm- und Tabellenzeitraum: ${periodRows[0].KW} bis ${periodRows[periodRows.length-1].KW}`;
  latestChip.textContent="KPI-Karten: KW frei wählbar";
}

function svgEl(name,attrs={},text=""){const e=document.createElementNS("http://www.w3.org/2000/svg",name);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));if(text)e.textContent=text;return e}
function showTip(evt,html){tooltip.innerHTML=html;tooltip.style.display="block";tooltip.style.left=(evt.clientX+12)+"px";tooltip.style.top=(evt.clientY+12)+"px"}
function hideTip(){tooltip.style.display="none"}

function lineChart(id,labels,series,opt={}){
  const host=document.getElementById(id); if(!host)return;
  host.innerHTML="";
  const W=900,H=330,m={l:62,r:22,t:22,b:48},pw=W-m.l-m.r,ph=H-m.t-m.b;
  const values=series.flatMap(s=>s.values.filter(v=>v!==null&&Number.isFinite(v)));
  if(!values.length){host.innerHTML='<div class="empty">Keine Daten im ausgewählten Zeitraum.</div>';return}
  let min=opt.zero?Math.min(0,...values):Math.min(...values),max=Math.max(...values);
  if(min===max){min-=1;max+=1}
  const pad=(max-min)*.08;min-=pad;max+=pad;
  const x=i=>m.l+(labels.length===1?pw/2:i*pw/(labels.length-1));
  const y=v=>m.t+(max-v)*ph/(max-min);
  const svg=svgEl("svg",{viewBox:`0 0 ${W} ${H}`,"aria-label":opt.title||"Diagramm"});
  for(let i=0;i<=5;i++){
    const yy=m.t+i*ph/5,val=max-i*(max-min)/5;
    svg.append(svgEl("line",{x1:m.l,y1:yy,x2:W-m.r,y2:yy,stroke:"#e5ebf1","stroke-width":1}));
    svg.append(svgEl("text",{x:m.l-9,y:yy+4,"text-anchor":"end",fill:"#718096","font-size":11},opt.tick?opt.tick(val):fmtNum.format(val)));
  }
  // Achsenbeschriftung ausdünnen, damit die Labels bei vielen Werten nicht überlappen
  const maxLabels=opt.maxLabels||14;
  const step=Math.max(1,Math.ceil(labels.length/maxLabels));
  labels.forEach((lab,i)=>{
    if(step>1&&i%step!==0&&i!==labels.length-1)return;
    svg.append(svgEl("text",{x:x(i),y:H-19,"text-anchor":"middle",fill:"#718096","font-size":11},lab));
  });
  series.forEach((s,si)=>{
    let d="",open=false;
    s.values.forEach((v,i)=>{
      if(v===null||!Number.isFinite(v)){open=false;return}
      d+=(open?" L":" M")+x(i)+" "+y(v);open=true;
    });
    svg.append(svgEl("path",{d,fill:"none",stroke:s.color||colors[si%colors.length],"stroke-width":2.8,"stroke-linejoin":"round","stroke-linecap":"round"}));
    s.values.forEach((v,i)=>{
      if(v===null||!Number.isFinite(v))return;
      const c=svgEl("circle",{cx:x(i),cy:y(v),r:4.1,fill:s.color||colors[si%colors.length],stroke:"white","stroke-width":1.5,tabindex:0});
      c.addEventListener("mousemove",e=>showTip(e,`<b>${esc(s.name)}</b><br>${esc(labels[i])}: ${esc(s.format? s.format(v):fmtNum.format(v))}`));
      c.addEventListener("mouseleave",hideTip);svg.append(c)
    });
  });
  host.append(svg);
  const legend=document.createElement("div");legend.className="legend";
  legend.innerHTML=series.map((s,i)=>`<div class="legend-item"><span class="legend-swatch" style="background:${s.color||colors[i%colors.length]}"></span>${esc(s.name)}</div>`).join("");
  host.append(legend);
}
function barChart(id,items,opt={}){
  const host=document.getElementById(id);host.innerHTML="";
  if(!items.length){host.innerHTML='<div class="empty">Keine Daten.</div>';return}
  const W=720,H=315,m={l:58,r:20,t:18,b:74},pw=W-m.l-m.r,ph=H-m.t-m.b;
  const max=Math.max(...items.map(x=>x.value),1),bw=Math.min(60,pw/items.length*.62);
  const svg=svgEl("svg",{viewBox:`0 0 ${W} ${H}`});
  for(let i=0;i<=4;i++){const yy=m.t+i*ph/4,v=max-i*max/4;svg.append(svgEl("line",{x1:m.l,y1:yy,x2:W-m.r,y2:yy,stroke:"#e5ebf1"}));svg.append(svgEl("text",{x:m.l-8,y:yy+4,"text-anchor":"end",fill:"#718096","font-size":11},opt.tick?opt.tick(v):fmtNum.format(v)))}
  items.forEach((it,i)=>{
    const xx=m.l+(i+.5)*pw/items.length-bw/2,hh=it.value/max*ph,yy=m.t+ph-hh;
    const rect=svgEl("rect",{x:xx,y:yy,width:bw,height:hh,rx:5,fill:it.color||colors[i%colors.length]});
    rect.addEventListener("mousemove",e=>showTip(e,`<b>${esc(it.label)}</b><br>${esc(it.formatted||fmtNum.format(it.value))}`));rect.addEventListener("mouseleave",hideTip);svg.append(rect);
    const t=svgEl("text",{x:xx+bw/2,y:H-53,"text-anchor":"end",transform:`rotate(-35 ${xx+bw/2} ${H-53})`,fill:"#5f6f82","font-size":11},it.label);svg.append(t)
  });
  host.append(svg)
}
function normalize(rows,keys){
  const base={};keys.forEach(k=>base[k]=n(rows[0]?.[k]));
  return keys.map((k,i)=>({name:k,values:rows.map(r=>{const v=n(r[k]);return v===null||!base[k]?null:v/base[k]*100}),color:colors[i]}))
}
function renderOverviewCharts(){
  const rows=selectedWeekly(),labels=rows.map(r=>r.KW);if(!rows.length)return;
  const commercialKeys=["Umsatzmenge gesamt (m³)","Ø Preis gesamt (€/m³)","DB Netto (€)","Auftragseingang gesamt (m³)"];
  const commNames=["Umsatz","Ø Preis","DB Netto","Auftragseingang"];
  const comm=normalize(rows,commercialKeys).map((s,i)=>({...s,name:commNames[i],format:v=>fmtNum.format(v)}));
  lineChart("commercialChart",labels,comm,{tick:v=>fmtNum.format(v)});
  const opKeys=["Produktion KW gesamt (fm)","Auftragsbestand 4W (m³)","Lagerbestand (m³)","Verladungen gesamt"];
  const opNames=["Produktion","4W Bestand","Lager","Verladungen"];
  const ops=normalize(rows,opKeys).map((s,i)=>({...s,name:opNames[i]}));
  lineChart("operationsChart",labels,ops,{tick:v=>fmtNum.format(v)});
  const refinementRow=DATA.weekly.find(r=>r["KW Nr."]===Number(refinementWeek.value))||rows[rows.length-1];
  const ytdRow=DATA.weekly.find(r=>r["KW Nr."]===Number(ytdWeek.value))||rows[rows.length-1];
  const items=[
    {label:"Trocknung",value:n(refinementRow["Trocknung (m³)"])||0,formatted:format(refinementRow["Trocknung (m³)"],"m3")},
    {label:"Hobelung",value:n(refinementRow["Hobelung (m³)"])||0,formatted:format(refinementRow["Hobelung (m³)"],"m3")},
    {label:"Imprägnierung",value:n(refinementRow["Imprägnierung (m³)"])||0,formatted:format(refinementRow["Imprägnierung (m³)"],"m3")}
  ];
  refinementSub.textContent=`${refinementRow.KW} · Trocknung, Hobelung und Imprägnierung`;
  barChart("refinementChart",items,{tick:v=>fmt0.format(v)});
  ytdSnapshotSub.textContent=`${ytdRow.KW} · 2026 gegenüber 2025`;
  ytdSnapshot.innerHTML=[
    ["Produktion fm",ytdRow["Produktion YTD 2026 (fm)"],ytdRow["Produktion YTD 2025 (fm)"],"fm"],
    ["Produktion m³",ytdRow["Produktion YTD 2026 (m³)"],ytdRow["Produktion YTD 2025 (m³)"],"m3"],
    ["RHP fm",ytdRow["RHP YTD 2026 (fm)"],ytdRow["RHP YTD 2025 (fm)"],"fm"]
  ].map(([label,a,b,type])=>{const d=b?(a-b)/b:null;return `<div class="stat-row"><div><b>${label}</b><div class="small">2026: ${format(a,type)} · 2025: ${format(b,type)}</div></div><div class="delta ${deltaClass(d)}">${d===null?"–":(d>=0?"+":"")+format(d,"percent")}</div></div>`}).join("");
  const ok=DATA.areaSummary.filter(x=>x.Status==="Bestanden").length,warn=DATA.areaSummary.length-ok;
  qualityMini.innerHTML=`<div class="stat-row"><span class="stat-label">Bereiche bestanden</span><span class="stat-value">${ok}</span></div>
  <div class="stat-row"><span class="stat-label">Bereiche auffällig</span><span class="stat-value">${warn}</span></div>
  <div class="stat-row"><span class="stat-label">Dokumentierte Prüffälle</span><span class="stat-value">${DATA.issues.length}</span></div>
  <div class="stat-row"><span class="stat-label">Hohe Priorität</span><span class="stat-value">${DATA.issues.filter(x=>x.Priorität==="Hoch").length}</span></div>`;
}
const STATISTICS_LAYOUT_KEY="kwDashboardStatisticsModulesV1";
let statisticsModules=[];
let statisticsTopZ=20;

function statisticsDefinitions(){
  return kpiCatalog().filter(def=>{
    if(String(def.group||"").startsWith("Sägelinie"))return false;
    if(def.mode==="quality-card"||typeof def.series!=="function")return false;
    try{return def.series().some(point=>Number.isFinite(point.week)&&point.value!==null)}
    catch(error){return false}
  });
}
function statisticsGroups(){
  return [...new Set(statisticsDefinitions().map(def=>def.group))];
}
function statisticsMetricOptions(selected="",groupFilter=null){
  const definitions=statisticsDefinitions().filter(def=>!groupFilter||def.group===groupFilter);
  const groups=[...new Set(definitions.map(def=>def.group))];
  return groups.map(group=>`<optgroup label="${esc(group)}">${definitions.filter(def=>def.group===group).map(def=>
    `<option value="${esc(def.id)}" ${def.id===selected?"selected":""}>${esc(def.label)}</option>`
  ).join("")}</optgroup>`).join("");
}
function statisticsPeriodLabel(period){
  if(String(period)==="4")return "4 Wochen";
  if(String(period)==="13")return "3 Monate";
  if(String(period)==="26")return "6 Monate";
  if(String(period)==="free")return "Freies Fenster";
  return "Vorjahresvergleich";
}
function statisticsAverage(values){
  const valid=values.filter(value=>value!==null&&Number.isFinite(value));
  return valid.length?valid.reduce((sum,value)=>sum+value,0)/valid.length:null;
}
function statisticsStdDev(values){
  const valid=values.filter(value=>value!==null&&Number.isFinite(value));
  if(valid.length<2)return null;
  const avg=statisticsAverage(valid);
  return Math.sqrt(valid.reduce((sum,value)=>sum+(value-avg)**2,0)/valid.length);
}
function statisticsPercentText(value){
  if(value===null||!Number.isFinite(value))return "–";
  return `${value>=0?"+":""}${format(value,"percent")}`;
}
function statisticsYearPair(def){
  const pairs={
    "Produktion YTD 2026 (fm)":{current:"Produktion YTD 2026 (fm)",previous:"Produktion YTD 2025 (fm)",type:"fm",label:"Produktion YTD · fm"},
    "Produktion YTD 2026 (m³)":{current:"Produktion YTD 2026 (m³)",previous:"Produktion YTD 2025 (m³)",type:"m3",label:"Produktion YTD · m³"},
    "RHP YTD 2026 (fm)":{current:"RHP YTD 2026 (fm)",previous:"RHP YTD 2025 (fm)",type:"fm",label:"RHP YTD · fm"},
    "ytd::Produktion fm 2026":{source:"ytd",current:"Produktion fm 2026",previous:"Produktion fm 2025",type:"fm",label:"Produktion YTD · fm"},
    "ytd::Produktion m³ 2026":{source:"ytd",current:"Produktion m³ 2026",previous:"Produktion m³ 2025",type:"m3",label:"Produktion YTD · m³"},
    "ytd::RHP fm 2026":{source:"ytd",current:"RHP fm 2026",previous:"RHP fm 2025",type:"fm",label:"RHP YTD · fm"}
  };
  return pairs[def.id]||null;
}
function statisticsYearSeries(pair,endWeek){
  const source=pair.source==="ytd"?DATA.ytd:DATA.weekly;
  return source.map(row=>({
    week:pair.source==="ytd"?weekNo(row.KW):Number(row["KW Nr."]),
    current:n(row[pair.current]),previous:n(row[pair.previous])
  })).filter(point=>Number.isFinite(point.week)&&point.week<=endWeek&&point.current!==null&&point.previous!==null)
    .sort((a,b)=>a.week-b.week);
}
function statisticsSeries(def,endWeek,period){
  const limit=Number(period);
  return def.series().filter(point=>Number.isFinite(point.week)&&point.week<=endWeek&&point.value!==null)
    .sort((a,b)=>a.week-b.week).slice(-limit);
}
/* Freies Zeitfenster über alle geladenen Jahre (Von Jahr/KW – Bis Jahr/KW). */
function statisticsWeeklyHistorySource(){
  return (DATA.weeklyHistory&&DATA.weeklyHistory.length)?DATA.weeklyHistory:(DATA.weekly||[]);
}
function statisticsFreeYears(){
  const dy=historyDashboardYear();
  const ys=[...new Set(statisticsWeeklyHistorySource().map(r=>historyRowYear(r,dy)))].sort((a,b)=>a-b);
  return ys.length?ys:[dy];
}
function statisticsFreeWeeksForYear(year){
  const dy=historyDashboardYear();
  return [...new Set(statisticsWeeklyHistorySource().filter(r=>historyRowYear(r,dy)===Number(year)).map(r=>r["KW Nr."]).filter(Number.isFinite))].sort((a,b)=>a-b);
}
function statisticsFreeSeries(def,fromY,fromKW,toY,toKW){
  if(!def)return [];
  const key=def.id,dy=historyDashboardYear(),src=statisticsWeeklyHistorySource();
  if(!src.some(r=>typeof r[key]==="number"))return [];   // freies Fenster nur für Wochenkennzahlen
  const ordF=Number(fromY)*100+Number(fromKW),ordT=Number(toY)*100+Number(toKW);
  return src.map(r=>({year:historyRowYear(r,dy),week:r["KW Nr."],value:n(r[key])}))
    .filter(p=>p.value!==null&&Number.isFinite(p.week)&&(p.year*100+p.week)>=ordF&&(p.year*100+p.week)<=ordT)
    .sort((a,b)=>(a.year-b.year)||(a.week-b.week));
}
function statisticsFreeWindowOf(item){
  const years=statisticsFreeYears();
  const y0=years[0],y1=years[years.length-1];
  const wFrom=statisticsFreeWeeksForYear(item?.fromYear??y0);
  const wTo=statisticsFreeWeeksForYear(item?.toYear??y1);
  return {
    fromYear:Number(item?.fromYear??y0),
    fromWeek:Number(item?.fromWeek??(wFrom[0]??1)),
    toYear:Number(item?.toYear??y1),
    toWeek:Number(item?.toWeek??(wTo[wTo.length-1]??1))
  };
}
function statisticsFreeSummary(def,item){
  const w=statisticsFreeWindowOf(item);
  const series=statisticsFreeSeries(def,w.fromYear,w.fromWeek,w.toYear,w.toWeek);
  const values=series.map(p=>p.value);
  const latest=series.at(-1)?.value??null,first=series[0]?.value??null;
  const avg=statisticsAverage(values),min=values.length?Math.min(...values):null,max=values.length?Math.max(...values):null;
  const change=latest!==null&&first!==null?latest-first:null;
  const changePct=first?change/Math.abs(first):null;
  const deviation=statisticsStdDev(values);
  return {series,latest,avg,min,max,change,changePct,deviation,window:w};
}
function statisticsFreeWindowLabel(w){
  return `KW${String(w.fromWeek).padStart(2,"0")}/${w.fromYear} – KW${String(w.toWeek).padStart(2,"0")}/${w.toYear}`;
}
function defaultStatisticsLayout(){
  const latest=Math.max(...availableDashboardWeeks());
  const defs=[
    ["Umsatzmenge gesamt (m³)","4",20,20,500,370],
    ["Ø Preis gesamt (€/m³)","13",540,20,500,370],
    ["Produktion YTD 2026 (fm)","yoy",20,415,500,370],
    ["Auftragseingang gesamt (m³)","4",540,415,500,370]
  ];
  return defs.map((item,index)=>({
    id:`stat-${Date.now()}-${index}`,metric:item[0],period:item[1],endWeek:latest,
    x:item[2],y:item[3],w:item[4],h:item[5],z:index+1
  }));
}
function loadStatisticsLayout(){
  try{
    const saved=JSON.parse(storageGet(STATISTICS_LAYOUT_KEY)||"null");
    statisticsModules=Array.isArray(saved)?saved:defaultStatisticsLayout();
  }catch(error){statisticsModules=defaultStatisticsLayout()}
  statisticsTopZ=Math.max(20,...statisticsModules.map(item=>item.z||1));
}
function saveStatisticsLayout(){
  storageSet(STATISTICS_LAYOUT_KEY,JSON.stringify(statisticsModules));
  statisticsLayoutStatus.textContent=`${statisticsModules.length} Statistikmodul${statisticsModules.length===1?"":"e"} gespeichert`;
}
function findStatisticsModule(id){return statisticsModules.find(item=>item.id===id)}
function refreshStatisticsBuilderMetrics(preferredMetric=null){
  if(!document.getElementById("statisticsBuilderMetric"))return;
  const group=statisticsBuilderGroup.value||statisticsGroups()[0];
  const definitions=statisticsDefinitions().filter(def=>def.group===group);
  const preferred=preferredMetric||statisticsBuilderMetric.value;
  statisticsBuilderMetric.innerHTML=definitions.map(def=>`<option value="${esc(def.id)}">${esc(def.label)}</option>`).join("");
  if(definitions.some(def=>def.id===preferred))statisticsBuilderMetric.value=preferred;
}
function addStatisticsModules(definitions,period,endWeek,freeWin){
  const start=statisticsModules.length;
  definitions.forEach((def,index)=>{
    const absolute=start+index;
    const mod={
      id:`stat-${Date.now()}-${index}`,metric:def.id,period:String(period),endWeek:Number(endWeek),
      x:20+(absolute%2)*520,y:20+Math.floor(absolute/2)*395,w:500,h:370,z:++statisticsTopZ
    };
    if(String(period)==="free"&&freeWin){mod.fromYear=freeWin.fromYear;mod.fromWeek=freeWin.fromWeek;mod.toYear=freeWin.toYear;mod.toWeek=freeWin.toWeek;}
    statisticsModules.push(mod);
  });
  saveStatisticsLayout();renderStatisticsBoard();
}
function readStatFreeToolbar(){
  const g=id=>Number((document.getElementById(id)||{}).value);
  const win={fromYear:g("statFromYear"),fromWeek:g("statFromWeek"),toYear:g("statToYear"),toWeek:g("statToWeek")};
  const ordF=win.fromYear*100+win.fromWeek,ordT=win.toYear*100+win.toWeek;
  if(ordF>ordT){win.toYear=win.fromYear;win.toWeek=win.fromWeek;}
  return win;
}
function refreshStatFreeToolbar(){
  const years=statisticsFreeYears();
  const fill=(id,items,val)=>{const sel=document.getElementById(id);if(!sel)return;sel.innerHTML=items.map(it=>`<option value="${it.v}">${it.l}</option>`).join("");if(val!==undefined&&items.some(it=>String(it.v)===String(val)))sel.value=String(val);};
  fill("statFromYear",years.map(y=>({v:y,l:String(y)})),years[0]);
  fill("statToYear",years.map(y=>({v:y,l:String(y)})),years[years.length-1]);
  const wf=statisticsFreeWeeksForYear(document.getElementById("statFromYear")?document.getElementById("statFromYear").value:years[0]);
  const wt=statisticsFreeWeeksForYear(document.getElementById("statToYear")?document.getElementById("statToYear").value:years[years.length-1]);
  fill("statFromWeek",wf.map(w=>({v:w,l:"KW"+w})),wf[0]);
  fill("statToWeek",wt.map(w=>({v:w,l:"KW"+w})),wt[wt.length-1]);
}
function toggleStatFreeControls(){
  const free=(document.getElementById("statisticsBuilderPeriod")||{}).value==="free";
  document.querySelectorAll("[data-stat-free]").forEach(el=>el.hidden=!free);
  document.querySelectorAll("[data-stat-endweek]").forEach(el=>el.hidden=free);
  if(free)refreshStatFreeToolbar();
}
function initStatisticsBoard(weeks){
  const groups=statisticsGroups();
  statisticsBuilderGroup.innerHTML=groups.map(group=>`<option value="${esc(group)}">${esc(group)}</option>`).join("");
  statisticsBuilderGroup.value=groups[0]||"";
  refreshStatisticsBuilderMetrics();
  statisticsBuilderGroup.addEventListener("change",()=>refreshStatisticsBuilderMetrics());

  statisticsBuilderWeek.innerHTML=weeks.map(week=>`<option value="${week}">KW${week}</option>`).join("");
  statisticsBuilderWeek.value=String(Math.max(...weeks));
  loadStatisticsLayout();

  refreshStatFreeToolbar();
  toggleStatFreeControls();
  statisticsBuilderPeriod.addEventListener("change",toggleStatFreeControls);
  ["statFromYear","statToYear"].forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.addEventListener("change",()=>{
      const target=id==="statFromYear"?"statFromWeek":"statToWeek";
      const wk=statisticsFreeWeeksForYear(el.value);
      const sel=document.getElementById(target);
      if(sel)sel.innerHTML=wk.map(w=>`<option value="${w}">KW${w}</option>`).join("");
    });
  });

  addStatisticsModuleBtn.addEventListener("click",()=>{
    const def=resolveKpiDefinition(statisticsBuilderMetric.value);
    if(!def)return;
    const free=statisticsBuilderPeriod.value==="free";
    addStatisticsModules([def],statisticsBuilderPeriod.value,statisticsBuilderWeek.value,free?readStatFreeToolbar():null);
  });
  addStatisticsGroupBtn.addEventListener("click",()=>{
    const definitions=statisticsDefinitions().filter(def=>def.group===statisticsBuilderGroup.value);
    if(!definitions.length)return;
    if(definitions.length>20&&!confirm(`${definitions.length} Statistikmodule aus „${statisticsBuilderGroup.value}“ hinzufügen?`))return;
    const free=statisticsBuilderPeriod.value==="free";
    addStatisticsModules(definitions,statisticsBuilderPeriod.value,statisticsBuilderWeek.value,free?readStatFreeToolbar():null);
    autoArrangeStatisticsModules();
  });
  autoLayoutStatisticsBtn.addEventListener("click",autoArrangeStatisticsModules);
  defaultStatisticsBtn.addEventListener("click",()=>{
    statisticsModules=defaultStatisticsLayout();saveStatisticsLayout();renderStatisticsBoard();
  });
  clearStatisticsBtn.addEventListener("click",()=>{
    if(confirm("Alle Statistikmodule entfernen?")){
      statisticsModules=[];saveStatisticsLayout();renderStatisticsBoard();
    }
  });
  renderStatisticsBoard();
}
function statisticsRegularSummary(def,item){
  const requested=Number(item.period);
  const series=statisticsSeries(def,Number(item.endWeek),requested);
  const values=series.map(point=>point.value);
  const latest=series.at(-1)?.value??null,first=series[0]?.value??null;
  const avg=statisticsAverage(values),min=values.length?Math.min(...values):null,max=values.length?Math.max(...values):null;
  const change=latest!==null&&first!==null?latest-first:null;
  const changePct=first?change/Math.abs(first):null;
  const deviation=statisticsStdDev(values);
  return {series,latest,avg,min,max,change,changePct,deviation,requested};
}
function statisticsWindowControlMarkup(item,weeks){
  if(String(item.period)!=="free"){
    return `<select data-statistics-role="week" aria-label="End-KW auswählen">${weeks.map(week=>`<option value="${week}" ${Number(item.endWeek)===week?"selected":""}>KW${week}</option>`).join("")}</select>`;
  }
  const w=statisticsFreeWindowOf(item);
  const years=statisticsFreeYears();
  const yOpts=sel=>years.map(y=>`<option value="${y}" ${Number(sel)===y?"selected":""}>${y}</option>`).join("");
  const wOpts=(yr,sel)=>statisticsFreeWeeksForYear(yr).map(wk=>`<option value="${wk}" ${Number(sel)===wk?"selected":""}>KW${wk}</option>`).join("");
  return `<div class="stat-mod-free">
    <select data-statistics-role="fromYear" title="Von Jahr">${yOpts(w.fromYear)}</select>
    <select data-statistics-role="fromWeek" title="Von KW">${wOpts(w.fromYear,w.fromWeek)}</select>
    <span aria-hidden="true">–</span>
    <select data-statistics-role="toYear" title="Bis Jahr">${yOpts(w.toYear)}</select>
    <select data-statistics-role="toWeek" title="Bis KW">${wOpts(w.toYear,w.toWeek)}</select>
  </div>`;
}
function statisticsModuleMarkup(item){
  const def=resolveKpiDefinition(item.metric)||statisticsDefinitions()[0];
  const title=def?.label||item.metric;
  const weeks=availableDashboardWeeks();
  const metricOptions=statisticsMetricOptions(item.metric);
  const periodOptions=[["4","4 Wochen"],["13","3 Monate"],["26","6 Monate"],["yoy","Vorjahr"],["free","Freies Fenster"]];
  let body="";
  if(!def){
    body='<div class="statistics-module-warning">Die gespeicherte Kennzahl ist in den aktuellen Daten nicht mehr verfügbar.</div>';
  }else if(def.mode==="combo"){
    const stats=statisticsComboSummary(item);
    if(!stats.points.length){
      body=`<div class="statistics-module-warning">Für einen Vergleich müssen Wochenberichte (Umsatz) und Einkaufsdaten für dasselbe Jahr und dieselben Kalenderwochen vorliegen.</div>
        <div class="statistics-module-chart"><div class="chart" id="stat-chart-${esc(item.id)}"></div></div>`;
    }else{
      body=`<div class="statistics-module-summary">
        <div class="statistics-module-stat"><small>Umsatz je fm gel.</small><strong>${format(stats.latest,"pricefm")}</strong></div>
        <div class="statistics-module-stat"><small>Ø Verhältnis</small><strong>${format(stats.avg,"pricefm")}</strong></div>
        <div class="statistics-module-stat"><small>Gewichtet</small><strong>${format(stats.weighted,"pricefm")}</strong></div>
        <div class="statistics-module-stat"><small>Veränderung %</small><strong>${statisticsPercentText(stats.changePct)}</strong></div>
      </div>
      <div class="statistics-module-note">${stats.points.length} gemeinsame Wochen · Umsatz Σ ${format(stats.umsatzSum,"currency")} · fm geliefert Σ ${format(stats.fmSum,"fm")} · Linien indexiert (erste Woche = 100)</div>
      <div class="statistics-module-chart"><div class="chart" id="stat-chart-${esc(item.id)}"></div></div>`;
    }
  }else if(String(item.period)==="free"){
    const w=statisticsFreeWindowOf(item);
    const stats=statisticsFreeSummary(def,item);
    const wl=statisticsFreeWindowLabel(w);
    if(!stats.series.length){
      body=`<div class="statistics-module-warning">Für das gewählte Fenster (${esc(wl)}) liegen keine Wochenwerte dieser Kennzahl vor. Das freie Fenster gilt für Kennzahlen aus dem Wochenbericht.</div>
        <div class="statistics-module-chart"><div class="chart" id="stat-chart-${esc(item.id)}"></div></div>`;
    }else{
      body=`<div class="statistics-module-summary">
        <div class="statistics-module-stat"><small>Aktuell</small><strong>${format(stats.latest,def.type)}</strong></div>
        <div class="statistics-module-stat"><small>Ø</small><strong>${format(stats.avg,def.type)}</strong></div>
        <div class="statistics-module-stat"><small>Veränderung</small><strong>${stats.change===null?"–":`${stats.change>=0?"+":""}${format(stats.change,def.type)}`}</strong></div>
        <div class="statistics-module-stat"><small>Veränderung %</small><strong>${statisticsPercentText(stats.changePct)}</strong></div>
      </div>
      <div class="statistics-module-note">${esc(wl)} · ${stats.series.length} Wochen · Min ${format(stats.min,def.type)} · Max ${format(stats.max,def.type)} · σ ${format(stats.deviation,def.type)}</div>
      <div class="statistics-module-chart"><div class="chart" id="stat-chart-${esc(item.id)}"></div></div>`;
    }
  }else if(String(item.period)==="yoy"){
    const pair=statisticsYearPair(def);
    if(!pair){
      const current=def.series().filter(point=>point.week<=Number(item.endWeek)&&point.value!==null).sort((a,b)=>a.week-b.week);
      body=`<div class="statistics-module-warning">Für diese Kennzahl sind keine belastbaren Vorjahreswerte vorhanden. Der aktuelle Verlauf wird ohne Schätzung angezeigt.</div>
        <div class="statistics-module-summary">
          <div class="statistics-module-stat"><small>Aktuell</small><strong>${format(current.at(-1)?.value,def.type)}</strong></div>
          <div class="statistics-module-stat"><small>End-KW</small><strong>KW${item.endWeek}</strong></div>
          <div class="statistics-module-stat"><small>Vorjahr</small><strong>nicht verfügbar</strong></div>
          <div class="statistics-module-stat"><small>Status</small><strong>nicht geschätzt</strong></div>
        </div>
        <div class="statistics-module-chart"><div class="chart" id="stat-chart-${esc(item.id)}"></div></div>`;
    }else{
      const series=statisticsYearSeries(pair,Number(item.endWeek));
      const latest=series.at(-1),difference=latest?latest.current-latest.previous:null;
      const differencePct=latest?.previous?difference/Math.abs(latest.previous):null;
      body=`<div class="statistics-module-summary">
        <div class="statistics-module-stat"><small>2026</small><strong>${format(latest?.current,pair.type)}</strong></div>
        <div class="statistics-module-stat"><small>2025</small><strong>${format(latest?.previous,pair.type)}</strong></div>
        <div class="statistics-module-stat"><small>Differenz</small><strong>${difference===null?"–":`${difference>=0?"+":""}${format(difference,pair.type)}`}</strong></div>
        <div class="statistics-module-stat"><small>Differenz %</small><strong>${statisticsPercentText(differencePct)}</strong></div>
      </div>
      <div class="statistics-module-note">Kumulierte Werte bis KW${item.endWeek} · echte Vorjahresdaten</div>
      <div class="statistics-module-chart"><div class="chart" id="stat-chart-${esc(item.id)}"></div></div>`;
    }
  }else{
    const stats=statisticsRegularSummary(def,item);
    body=`<div class="statistics-module-summary">
      <div class="statistics-module-stat"><small>Aktuell</small><strong>${format(stats.latest,def.type)}</strong></div>
      <div class="statistics-module-stat"><small>Ø</small><strong>${format(stats.avg,def.type)}</strong></div>
      <div class="statistics-module-stat"><small>Veränderung</small><strong>${stats.change===null?"–":`${stats.change>=0?"+":""}${format(stats.change,def.type)}`}</strong></div>
      <div class="statistics-module-stat"><small>Veränderung %</small><strong>${statisticsPercentText(stats.changePct)}</strong></div>
    </div>
    <div class="statistics-module-note">${stats.series.length} von ${stats.requested} Wochen verfügbar · Min ${format(stats.min,def.type)} · Max ${format(stats.max,def.type)} · σ ${format(stats.deviation,def.type)}</div>
    <div class="statistics-module-chart"><div class="chart" id="stat-chart-${esc(item.id)}"></div></div>`;
  }
  return `<article class="statistics-module-window" data-statistics-id="${esc(item.id)}"
    style="left:${item.x}px;top:${item.y}px;width:${item.w}px;height:${item.h}px;z-index:${item.z||1}">
    <header class="statistics-module-head" data-statistics-drag>
      <span aria-hidden="true">⠿</span>
      <span class="statistics-module-title" title="${esc(title)}">${esc(title)} · ${statisticsPeriodLabel(item.period)}</span>
      <button class="statistics-module-action" data-statistics-duplicate type="button" title="Duplizieren">⧉</button>
      <button class="statistics-module-action" data-statistics-remove type="button" title="Entfernen">×</button>
    </header>
    <div class="statistics-module-controls">
      <select data-statistics-role="metric" aria-label="Kennzahl auswählen">${metricOptions}</select>
      <select data-statistics-role="period" aria-label="Zeitraum auswählen">${periodOptions.map(([value,label])=>`<option value="${value}" ${String(item.period)===value?"selected":""}>${label}</option>`).join("")}</select>
      ${statisticsWindowControlMarkup(item,weeks)}
    </div>
    <div class="statistics-module-body">${body}</div>
    <div class="statistics-module-resize" data-statistics-resize title="Modulgröße ändern"></div>
  </article>`;
}
function renderStatisticsModuleChart(item){
  const def=resolveKpiDefinition(item.metric);
  const target=`stat-chart-${item.id}`;
  if(!def||!document.getElementById(target))return;
  if(def.mode==="combo"){
    const points=comboWindowedPoints(item);
    if(!points.length){lineChart(target,[],[]);return;}
    const baseU=points[0].umsatz,baseF=points[0].fmGeliefert;
    const idx=(value,base)=>(value!==null&&base)?value/base*100:null;
    lineChart(target,points.map(point=>`KW${point.week}`),[
      {name:"Umsatz (Index)",values:points.map(point=>idx(point.umsatz,baseU)),format:value=>value===null?"–":fmt0.format(value)},
      {name:"fm geliefert (Index)",values:points.map(point=>idx(point.fmGeliefert,baseF)),format:value=>value===null?"–":fmt0.format(value)}
    ],{zero:false,tick:value=>fmt0.format(value)});
    return;
  }
  if(String(item.period)==="free"){
    const stats=statisticsFreeSummary(def,item);
    if(!stats.series.length){lineChart(target,[],[]);return;}
    const y0=stats.series[0].year;
    const multiYear=stats.series.some(p=>p.year!==y0);
    const labels=stats.series.map(p=>multiYear?`KW${p.week}·${String(p.year).slice(2)}`:`KW${p.week}`);
    lineChart(target,labels,[
      {name:def.label,values:stats.series.map(p=>p.value),format:value=>format(value,def.type)},
      {name:"Fenster-Ø",values:stats.series.map(()=>stats.avg),format:value=>format(value,def.type)}
    ],{zero:false,tick:value=>fmtNum.format(value)});
    return;
  }
  if(String(item.period)==="yoy"){
    const pair=statisticsYearPair(def);
    if(pair){
      const series=statisticsYearSeries(pair,Number(item.endWeek));
      lineChart(target,series.map(point=>`KW${point.week}`),[
        {name:"2026",values:series.map(point=>point.current),format:value=>format(value,pair.type)},
        {name:"2025",values:series.map(point=>point.previous),format:value=>format(value,pair.type)}
      ],{zero:false,tick:value=>fmtNum.format(value)});
    }else{
      const current=def.series().filter(point=>point.week<=Number(item.endWeek)&&point.value!==null).sort((a,b)=>a.week-b.week);
      lineChart(target,current.map(point=>`KW${point.week}`),[
        {name:def.label,values:current.map(point=>point.value),format:value=>format(value,def.type)}
      ],{zero:false,tick:value=>fmtNum.format(value)});
    }
    return;
  }
  const stats=statisticsRegularSummary(def,item);
  lineChart(target,stats.series.map(point=>`KW${point.week}`),[
    {name:def.label,values:stats.series.map(point=>point.value),format:value=>format(value,def.type)},
    {name:"Zeitraum-Ø",values:stats.series.map(()=>stats.avg),format:value=>format(value,def.type)}
  ],{zero:false,tick:value=>fmtNum.format(value)});
}
function focusStatisticsModule(element,item){
  statisticsWorkspace.querySelectorAll(".statistics-module-window").forEach(node=>node.classList.remove("focused"));
  element.classList.add("focused");item.z=++statisticsTopZ;element.style.zIndex=item.z;
}
function bindStatisticsModule(element){
  const id=element.dataset.statisticsId,item=findStatisticsModule(id);
  element.addEventListener("pointerdown",()=>focusStatisticsModule(element,item));
  element.querySelector("[data-statistics-remove]").addEventListener("click",event=>{
    event.stopPropagation();statisticsModules=statisticsModules.filter(module=>module.id!==id);
    saveStatisticsLayout();renderStatisticsBoard();
  });
  element.querySelector("[data-statistics-duplicate]").addEventListener("click",event=>{
    event.stopPropagation();statisticsModules.push({...item,id:`stat-${Date.now()}`,x:item.x+30,y:item.y+30,z:++statisticsTopZ});
    saveStatisticsLayout();renderStatisticsBoard();
  });
  element.querySelector('[data-statistics-role="metric"]').addEventListener("change",event=>{
    item.metric=event.target.value;saveStatisticsLayout();renderStatisticsBoard();
  });
  element.querySelector('[data-statistics-role="period"]').addEventListener("change",event=>{
    item.period=event.target.value;
    if(item.period==="free"&&item.fromYear===undefined)Object.assign(item,statisticsFreeWindowOf(item));
    saveStatisticsLayout();renderStatisticsBoard();
  });
  const weekSel=element.querySelector('[data-statistics-role="week"]');
  if(weekSel)weekSel.addEventListener("change",event=>{
    item.endWeek=Number(event.target.value);saveStatisticsLayout();renderStatisticsBoard();
  });
  ["fromYear","fromWeek","toYear","toWeek"].forEach(role=>{
    const el=element.querySelector(`[data-statistics-role="${role}"]`);
    if(!el)return;
    el.addEventListener("change",event=>{
      item[role]=Number(event.target.value);
      if(role==="fromYear"){const wk=statisticsFreeWeeksForYear(item.fromYear);if(!wk.includes(Number(item.fromWeek)))item.fromWeek=wk[0]??item.fromWeek;}
      if(role==="toYear"){const wk=statisticsFreeWeeksForYear(item.toYear);if(!wk.includes(Number(item.toWeek)))item.toWeek=wk[wk.length-1]??item.toWeek;}
      const ordF=Number(item.fromYear)*100+Number(item.fromWeek),ordT=Number(item.toYear)*100+Number(item.toWeek);
      if(ordF>ordT){ if(role.startsWith("from")){item.toYear=item.fromYear;item.toWeek=item.fromWeek;} else {item.fromYear=item.toYear;item.fromWeek=item.toWeek;} }
      saveStatisticsLayout();renderStatisticsBoard();
    });
  });
  const head=element.querySelector("[data-statistics-drag]");
  head.addEventListener("pointerdown",event=>{
    if(event.target.closest("button"))return;
    event.preventDefault();head.setPointerCapture(event.pointerId);focusStatisticsModule(element,item);
    const startX=event.clientX,startY=event.clientY,originX=item.x,originY=item.y;
    const move=moveEvent=>{
      item.x=Math.max(0,Math.round((originX+moveEvent.clientX-startX)/5)*5);
      item.y=Math.max(0,Math.round((originY+moveEvent.clientY-startY)/5)*5);
      element.style.left=item.x+"px";element.style.top=item.y+"px";
      statisticsWorkspace.style.height=Math.max(740,item.y+item.h+30)+"px";
    };
    const up=()=>{head.removeEventListener("pointermove",move);head.removeEventListener("pointerup",up);saveStatisticsLayout()};
    head.addEventListener("pointermove",move);head.addEventListener("pointerup",up,{once:true});
  });
  const resize=element.querySelector("[data-statistics-resize]");
  resize.addEventListener("pointerdown",event=>{
    event.preventDefault();event.stopPropagation();resize.setPointerCapture(event.pointerId);focusStatisticsModule(element,item);
    const startX=event.clientX,startY=event.clientY,originW=item.w,originH=item.h;
    const move=moveEvent=>{
      item.w=Math.max(360,Math.round((originW+moveEvent.clientX-startX)/5)*5);
      item.h=Math.max(285,Math.round((originH+moveEvent.clientY-startY)/5)*5);
      element.style.width=item.w+"px";element.style.height=item.h+"px";
      statisticsWorkspace.style.height=Math.max(740,item.y+item.h+30)+"px";
    };
    const up=()=>{resize.removeEventListener("pointermove",move);resize.removeEventListener("pointerup",up);saveStatisticsLayout();renderStatisticsBoard()};
    resize.addEventListener("pointermove",move);resize.addEventListener("pointerup",up,{once:true});
  });
}
function autoArrangeStatisticsModules(){
  const available=Math.max(1080,statisticsWorkspace.parentElement.clientWidth-20),tileW=500,tileH=370,gap=20;
  const columns=Math.max(1,Math.floor((available-gap)/(tileW+gap)));
  statisticsModules.forEach((item,index)=>{
    item.x=gap+(index%columns)*(tileW+gap);item.y=gap+Math.floor(index/columns)*(tileH+gap);
    item.w=tileW;item.h=tileH;item.z=index+1;
  });
  statisticsTopZ=statisticsModules.length+20;saveStatisticsLayout();renderStatisticsBoard();
}
function renderStatisticsBoard(){
  if(!document.getElementById("statisticsWorkspace"))return;
  if(!statisticsModules.length){
    statisticsWorkspace.innerHTML='<div class="statistics-workspace-empty">Über „Statistikmodul hinzufügen“ eine individuelle Analysewand aufbauen.</div>';
    statisticsWorkspace.style.height="740px";return;
  }
  statisticsWorkspace.innerHTML=statisticsModules.map(statisticsModuleMarkup).join("");
  statisticsWorkspace.style.height=Math.max(740,...statisticsModules.map(item=>item.y+item.h+30))+"px";
  statisticsWorkspace.querySelectorAll(".statistics-module-window").forEach(bindStatisticsModule);
  statisticsModules.forEach(renderStatisticsModuleChart);
}

/* ---------- Mehrfachvergleich (bis zu 4 KW-basierte Datensätze) ---------- */
const COMPARE_STORAGE_KEY="kwDashboardCompareV1";
const COMPARE_UNIT={m3:"m³",fm:"fm",price:"€/m³",pricefm:"€/fm",currency:"€",percent:"%",pctpoint:"%",lfm:"lfm",pieces:"Stück",minutes:"min",fmmin:"fm/min",m3min:"m³/min",number:""};
let comparisonState={metrics:["","","",""],horizon:"all",mode:"abs"};
function loadComparisonState(){
  try{const s=JSON.parse(storageGet(COMPARE_STORAGE_KEY)||"null");
    if(s&&Array.isArray(s.metrics)){comparisonState={metrics:(s.metrics.concat(["","","",""])).slice(0,4),horizon:s.horizon||"all",mode:s.mode||"abs"};}
  }catch(e){}
}
function saveComparisonState(){storageSet(COMPARE_STORAGE_KEY,JSON.stringify(comparisonState));}
function comparisonHorizonWeeks(allWeeks,horizon){
  const sorted=[...new Set(allWeeks)].sort((a,b)=>a-b);
  if(!sorted.length)return [];
  if(horizon==="all"||horizon==="ytd")return sorted;
  const count=Number(horizon)||sorted.length;
  return sorted.slice(-count);
}
function populateComparisonSelects(){
  const defs=statisticsDefinitions();
  const groups=[...new Set(defs.map(d=>d.group))];
  [1,2,3,4].forEach(slot=>{
    const sel=document.getElementById("cmpMetric"+slot);
    if(!sel)return;
    let cur=comparisonState.metrics[slot-1]||"";
    if(cur&&!defs.some(d=>d.id===cur)){cur="";comparisonState.metrics[slot-1]="";}
    const includeEmpty=slot>=3||!cur;   // Slots 3/4 optional; leere Option auch, wenn nichts gewählt
    const empty=includeEmpty?`<option value="">— keine —</option>`:"";
    sel.innerHTML=empty+groups.map(g=>`<optgroup label="${esc(g)}">${defs.filter(d=>d.group===g).map(d=>`<option value="${esc(d.id)}" ${d.id===cur?"selected":""}>${esc(d.label)}</option>`).join("")}</optgroup>`).join("");
    sel.value=cur;
  });
}
function renderComparison(){
  const chart=document.getElementById("cmpChart");
  if(!chart)return;
  populateComparisonSelects();
  const horizon=(document.getElementById("cmpHorizon")||{}).value||comparisonState.horizon;
  const mode=(document.getElementById("cmpMode")||{}).value||comparisonState.mode;
  comparisonState.horizon=horizon;comparisonState.mode=mode;
  // gewählte, eindeutige Datensätze (max 4)
  const picked=[];
  comparisonState.metrics.forEach(id=>{
    if(!id||picked.some(p=>p.id===id))return;
    const def=resolveKpiDefinition(id);
    if(def&&typeof def.series==="function")picked.push(def);
  });
  const sub=document.getElementById("cmpSub");
  const table=document.getElementById("cmpTable");
  if(!picked.length){
    lineChart("cmpChart",[],[]);
    if(table)table.innerHTML="";
    if(sub)sub.textContent="Beliebige Kennzahlen mit Kalenderwochen-Achse gemeinsam in einem Schaubild vergleichen – bitte mindestens einen Datensatz wählen.";
    return;
  }
  // Wochen-Wertetabellen je Datensatz
  const seriesMaps=picked.map(def=>{
    const map=new Map();
    try{def.series().forEach(p=>{if(Number.isFinite(p.week)&&p.value!==null&&Number.isFinite(Number(p.value)))map.set(Number(p.week),Number(p.value));});}catch(e){}
    return map;
  });
  const allWeeks=[...new Set(seriesMaps.flatMap(m=>[...m.keys()]))];
  const weeks=comparisonHorizonWeeks(allWeeks,horizon);
  if(!weeks.length){
    lineChart("cmpChart",[],[]);
    if(table)table.innerHTML="";
    if(sub)sub.textContent="Für die gewählten Datensätze liegen keine gemeinsamen Kalenderwochen vor.";
    return;
  }
  const labels=weeks.map(w=>`KW${w}`);
  const series=picked.map((def,i)=>{
    const map=seriesMaps[i];
    const raw=weeks.map(w=>map.has(w)?map.get(w):null);
    const base=raw.find(v=>v!==null&&Number.isFinite(v));
    const values=mode==="idx"
      ? raw.map(v=>(v!==null&&base)?v/base*100:null)
      : raw;
    return {name:def.label,color:colors[i%colors.length],type:def.type,raw,
      values,format:mode==="idx"?(v=>v===null?"–":fmtNum.format(v)+" %"):(v=>format(v,def.type))};
  });
  lineChart("cmpChart",labels,series,{zero:false,tick:value=>fmtNum.format(value)});
  // Wertetabelle je Datensatz
  if(table){
    const rows=series.map(s=>{
      const valid=s.raw.filter(v=>v!==null&&Number.isFinite(v));
      const first=valid[0]??null,last=valid.at(-1)??null;
      const avg=valid.length?valid.reduce((a,b)=>a+b,0)/valid.length:null;
      const deltaPct=(first!==null&&last!==null&&first!==0)?(last-first)/Math.abs(first):null;
      const unit=COMPARE_UNIT[s.type]||"";
      return `<tr>
        <td><span class="cmp-swatch" style="background:${s.color}"></span>${esc(s.name)}</td>
        <td>${esc(unit)}</td>
        <td class="num">${format(first,s.type)}</td>
        <td class="num">${format(last,s.type)}</td>
        <td class="num">${format(avg,s.type)}</td>
        <td class="num">${deltaPct===null?"–":(deltaPct>=0?"+":"")+format(deltaPct,"percent")}</td>
      </tr>`;
    }).join("");
    table.innerHTML=`<thead><tr><th>Datensatz</th><th>Einheit</th><th>Start</th><th>Aktuell</th><th>Ø</th><th>Δ %</th></tr></thead><tbody>${rows}</tbody>`;
  }
  if(sub){
    const hLabel={all:"Alle Kalenderwochen","4":"4 Wochen","13":"3 Monate","26":"6 Monate",ytd:"YTD"}[horizon]||"Zeitraum";
    const modeLabel=mode==="idx"?"indexiert (erste Woche = 100)":"Absolutwerte";
    sub.textContent=`${picked.length} ${picked.length===1?"Datensatz":"Datensätze"} · ${hLabel} · KW${weeks[0]}–KW${weeks[weeks.length-1]} (${weeks.length} Wochen) · ${modeLabel}`;
  }
}
function initComparison(){
  if(!document.getElementById("cmpChart"))return;
  loadComparisonState();
  populateComparisonSelects();
  // Standard: erste zwei verfügbaren Datensätze vorbelegen, falls noch nichts gewählt
  const defs=statisticsDefinitions();
  if(!comparisonState.metrics.some(Boolean)&&defs.length){
    comparisonState.metrics[0]=defs[0].id;
    if(defs[1])comparisonState.metrics[1]=defs[1].id;
    populateComparisonSelects();
  }
  const hSel=document.getElementById("cmpHorizon");if(hSel)hSel.value=comparisonState.horizon;
  const mSel=document.getElementById("cmpMode");if(mSel)mSel.value=comparisonState.mode;
  [1,2,3,4].forEach(slot=>{
    const sel=document.getElementById("cmpMetric"+slot);
    if(sel)sel.addEventListener("change",()=>{comparisonState.metrics[slot-1]=sel.value;saveComparisonState();renderComparison();});
  });
  if(hSel)hSel.addEventListener("change",()=>{comparisonState.horizon=hSel.value;saveComparisonState();renderComparison();});
  if(mSel)mSel.addEventListener("change",()=>{comparisonState.mode=mSel.value;saveComparisonState();renderComparison();});
}
function refreshStatisticsAfterDataChange(){
  if(!document.getElementById("statisticsBuilderGroup"))return;
  const currentGroup=statisticsBuilderGroup.value;
  const groups=statisticsGroups();
  statisticsBuilderGroup.innerHTML=groups.map(group=>`<option value="${esc(group)}">${esc(group)}</option>`).join("");
  statisticsBuilderGroup.value=groups.includes(currentGroup)?currentGroup:(groups[0]||"");
  refreshStatisticsBuilderMetrics();
  if(typeof toggleStatFreeControls==="function")toggleStatFreeControls();
  renderStatisticsBoard();
}
function renderTrends(){
  const rows=selectedWeekly(),labels=rows.map(r=>r.KW);
  lineChart("volumeChart",labels,[
    {name:"Umsatzmenge",values:rows.map(r=>n(r["Umsatzmenge gesamt (m³)"])),format:v=>format(v,"m3")},
    {name:"Auftragseingang",values:rows.map(r=>n(r["Auftragseingang gesamt (m³)"])),format:v=>format(v,"m3")}
  ],{zero:true,tick:v=>fmt0.format(v)});
  lineChart("priceDbChart",labels,[
    {name:"Ø Preis",values:rows.map(r=>n(r["Ø Preis gesamt (€/m³)"])),format:v=>format(v,"price")},
    {name:"DB je m³",values:rows.map(r=>n(r["DB (€/m³)"])),format:v=>format(v,"price")}
  ],{zero:true,tick:v=>fmtNum.format(v)});
  const ytd=selectedByWeek(DATA.ytd);
  lineChart("ytdFmChart",ytd.map(r=>r.KW),[
    {name:"2026",values:ytd.map(r=>n(r["Produktion fm 2026"])),format:v=>format(v,"fm")},
    {name:"2025",values:ytd.map(r=>n(r["Produktion fm 2025"])),format:v=>format(v,"fm")}
  ],{tick:v=>fmt0.format(v)});
  lineChart("rhpChart",ytd.map(r=>r.KW),[
    {name:"2026",values:ytd.map(r=>n(r["RHP fm 2026"])),format:v=>format(v,"fm")},
    {name:"2025",values:ytd.map(r=>n(r["RHP fm 2025"])),format:v=>format(v,"fm")}
  ],{tick:v=>fmt0.format(v)});
  const cols=[
    ["KW","text"],["Umsatzmenge gesamt (m³)","m3"],["Ø Preis gesamt (€/m³)","price"],["DB Netto (€)","currency"],
    ["DB (€/m³)","price"],["Produktion KW gesamt (fm)","fm"],["Auftragseingang gesamt (m³)","m3"],
    ["Auftragsbestand 4W (m³)","m3"],["Lagerbestand (m³)","m3"],["Verladungen gesamt","number"]
  ];
  renderTable("weeklyTable",rows,cols);
}
function renderQuality(){
  qualityCards.innerHTML=DATA.areaSummary.map(x=>`<div class="quality-card ${x.Status==="Bestanden"?"":"warn"}"><div class="quality-title">${esc(x.Bereich)} <span class="badge ${x.Status==="Bestanden"?"ok":"warn"}">${esc(x.Status)}</span></div><div class="quality-text">${esc(x.Prüfergebnis)}</div></div>`).join("");
  renderIssues()
}
function issueInRange(x){
  const a=+weekFrom.value,b=+weekTo.value,nums=(String(x.KW).match(/\d+/g)||[]).map(Number);
  return !nums.length||nums.some(w=>w>=a&&w<=b)
}
function renderIssues(){
  const p=priorityFilter.value,a=areaFilter.value,q=issueSearch.value.toLowerCase();
  const rows=DATA.issues.filter(x=>issueInRange(x)&&(!p||x.Priorität===p)&&(!a||x.Bereich===a)&&(!q||Object.values(x).join(" ").toLowerCase().includes(q)));
  const cols=[["KW","text"],["Bereich","text"],["Priorität","badge"],["Prüffall","text"],["Gemeldet","number"],["Rechnerisch/erwartet","number"],["Abweichung","number"],["Erläuterung","text"]];
  renderTable("issueTable",rows,cols);
}
function renderTable(id,rows,cols){
  const el=document.getElementById(id);
  el.innerHTML=`<thead><tr>${cols.map(c=>`<th>${esc(c[0])}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${cols.map(([key,type])=>{
    let val=r[key],content;
    if(type==="badge"){const cl=val==="Hoch"?"high":val==="Mittel"?"warn":"low";content=`<span class="badge ${cl}">${esc(val)}</span>`}
    else if(["m3","fm","price","pricefm","currency","percent","pctpoint"].includes(type))content=format(val,type);
    else if(type==="productionValue"){
      const unit=r.Einheit==="m³"?"m3":"fm";content=format(val,unit);
    }
    else if(type==="productionDelta"){
      const unit=r.Einheit==="m³"?"m3":"fm";content=val===null||val===undefined?"–":(Number(val)>=0?"+":"")+format(val,unit);
    }
    else if(type==="number")content=val===null||val===undefined?"–":fmtNum.format(val);
    else content=esc(val??"");
    const numeric=type==="number"||["m3","fm","price","pricefm","currency","percent","pctpoint","productionValue","productionDelta"].includes(type);
    const indent=type==="salesCategory"&&String(val).toLowerCase().startsWith("davon ")?" sales-indent":"";
    return `<td class="${numeric?"num":""}${indent}">${content}</td>`
  }).join("")}</tr>`).join("")}</tbody>`;
}


function selectableLandEndWeeks(){
  const weeks=availableDashboardWeeks();
  if(!weeks.length)return [30];
  const minWeek=Math.min(...weeks),maxWeek=Math.max(30,...weeks);
  return Array.from({length:maxWeek-minWeek+1},(_,i)=>minWeek+i);
}
function ensureLandEndWeekOptions(){
  if(!document.getElementById("landEndWeek"))return 30;
  const weeks=selectableLandEndWeeks();
  const current=Number(landEndWeek.value)||30;
  landEndWeek.innerHTML=weeks.map(week=>`<option value="${week}">KW${String(week).padStart(2,"0")}</option>`).join("");
  const target=weeks.includes(current)?current:(weeks.includes(30)?30:Math.max(...weeks));
  landEndWeek.value=String(target);
  return target;
}
function landMetricConfig(metric){
  const configs={
    "M%":{label:"M%",type:"pctpoint",zero:true},
    "M% HW-Säge":{label:"M% HW-Säge",type:"pctpoint",zero:true},
    "M% SW":{label:"M% SW",type:"pctpoint",zero:true},
    "Ø-Preis HW-Säge":{label:"Ø-Preis HW-Säge",type:"price",zero:false},
    "Ø-Preis Gesamt":{label:"Ø-Preis Gesamt",type:"price",zero:false}
  };
  return configs[metric]||configs["M%"];
}
function landComparisonRowsForWindow(presentWeeks){
  const allowed=new Set(presentWeeks);
  return (DATA.countryComparison||[])
    .filter(row=>allowed.has(Number(row["KW Nr."]))&&row.Land!=="NIR");
}
function landAverageByCountry(records,field){
  const countries=[...new Set(records.map(row=>row.Land))];
  return countries.map(country=>{
    const countryRows=records.filter(row=>row.Land===country).sort((a,b)=>a["KW Nr."]-b["KW Nr."]);
    const values=countryRows.map(row=>n(row[field])).filter(value=>value!==null);
    const latestRow=[...countryRows].reverse().find(row=>n(row[field])!==null);
    return {
      land:country,
      avg:values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null,
      latest:latestRow?n(latestRow[field]):null,
      latestWeek:latestRow?.["KW Nr."]??null,
      count:values.length,
      rows:countryRows
    };
  });
}
function landHeatColor(value,min,max){
  if(value===null||!Number.isFinite(value))return "";
  const ratio=(value-min)/(max-min||1);
  const hue=10+110*ratio;
  return `hsl(${hue} 68% ${92-30*ratio}%)`;
}
function formatLandMetric(value,type){
  return type==="price"?format(value,"price"):format(value,"pctpoint");
}
function renderLandOverview(records,presentWeeks,endWeek){
  const fields=[
    ["M%","pctpoint"],
    ["M% HW-Säge","pctpoint"],
    ["M% SW","pctpoint"],
    ["Ø-Preis HW-Säge","price"],
    ["Ø-Preis Gesamt","price"]
  ];
  const latestWeek=presentWeeks[presentWeeks.length-1];
  const latestRows=records.filter(row=>row["KW Nr."]===latestWeek);
  const countries=[...new Set(records.map(row=>row.Land))];

  landTopTitle.textContent="Länderübersicht der letzten verfügbaren Woche";
  landTrendTitle.textContent="Entwicklung der größten Märkte";
  landHeatmapTitle.textContent="Länderübersicht · letzte verfügbare Woche";
  landAverageTitle.textContent="Länderübersicht · 10‑Wochen-Durchschnitt";

  const ranked=latestRows
    .map(row=>({label:row.Land,value:n(row["M%"])||0}))
    .filter(item=>item.value>0)
    .sort((a,b)=>b.value-a.value)
    .slice(0,8);

  landTopSub.textContent=`KW${String(latestWeek).padStart(2,"0")} · Ranking nach M%`;
  barChart("landBarChart",ranked.map((item,index)=>({
    ...item,
    formatted:format(item.value,"pctpoint"),
    color:colors[index%colors.length]
  })),{tick:value=>fmtNum.format(value)+" %"});

  const top5=landAverageByCountry(records,"M%")
    .filter(item=>item.avg!==null)
    .sort((a,b)=>b.avg-a.avg)
    .slice(0,5);

  landTrendSub.textContent=`Top 5 nach durchschnittlichem M% · 10‑Wochen-Fenster bis KW${String(endWeek).padStart(2,"0")}`;
  lineChart("landTrendChart",presentWeeks.map(week=>`KW${String(week).padStart(2,"0")}`),top5.map(item=>({
    name:item.land,
    values:presentWeeks.map(week=>{
      const row=item.rows.find(entry=>entry["KW Nr."]===week);
      return n(row?.["M%"]);
    }),
    format:value=>format(value,"pctpoint")
  })),{zero:true,tick:value=>fmtNum.format(value)+" %"});

  const fieldRanges={};
  fields.forEach(([field])=>{
    const values=latestRows.map(row=>n(row[field])).filter(value=>value!==null);
    fieldRanges[field]={
      min:values.length?Math.min(...values):0,
      max:values.length?Math.max(...values):1
    };
  });

  landHeatmapSub.textContent=`Alle Länderkennzahlen aus KW${String(latestWeek).padStart(2,"0")}`;
  landTable.innerHTML=`<thead><tr>
    <th>Land</th>${fields.map(([field])=>`<th>${esc(field)}</th>`).join("")}
  </tr></thead><tbody>${latestRows
    .sort((a,b)=>(n(b["M%"])||0)-(n(a["M%"])||0))
    .map(row=>`<tr>
      <td>${esc(row.Land)}</td>
      ${fields.map(([field,type])=>{
        const value=n(row[field]),range=fieldRanges[field];
        return `<td class="land-overview-cell" style="background:${landHeatColor(value,range.min,range.max)}">${formatLandMetric(value,type)}</td>`;
      }).join("")}
    </tr>`).join("")}</tbody>`;

  const averageRows=countries.map(country=>{
    const countryRows=records.filter(row=>row.Land===country);
    const result={Land:country};
    fields.forEach(([field])=>{
      const values=countryRows.map(row=>n(row[field])).filter(value=>value!==null);
      result[field]=values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
      result[`${field} count`]=values.length;
    });
    return result;
  }).sort((a,b)=>(n(b["M%"])||0)-(n(a["M%"])||0));

  const averageRanges={};
  fields.forEach(([field])=>{
    const values=averageRows.map(row=>n(row[field])).filter(value=>value!==null);
    averageRanges[field]={
      min:values.length?Math.min(...values):0,
      max:values.length?Math.max(...values):1
    };
  });

  landAverageSub.textContent=`Durchschnitt aller fünf Kennzahlen über die verfügbaren Wochen im Fenster bis KW${String(endWeek).padStart(2,"0")}`;
  landAverageTable.innerHTML=`<thead><tr>
    <th>Land</th>${fields.map(([field])=>`<th>Ø ${esc(field)}</th>`).join("")}<th>Datenwochen</th>
  </tr></thead><tbody>${averageRows.map(row=>`<tr>
    <td>${esc(row.Land)}</td>
    ${fields.map(([field,type])=>{
      const value=n(row[field]),range=averageRanges[field];
      return `<td class="land-overview-cell" style="background:${landHeatColor(value,range.min,range.max)}">${formatLandMetric(value,type)}</td>`;
    }).join("")}
    <td>${row["M% count"]}/10</td>
  </tr>`).join("")}</tbody>`;
}
function renderLandMetric(records,presentWeeks,endWeek,metric){
  const config=landMetricConfig(metric);
  const averages=landAverageByCountry(records,metric)
    .filter(item=>item.avg!==null)
    .sort((a,b)=>b.avg-a.avg);
  const latestWeek=presentWeeks[presentWeeks.length-1];
  const latestRows=records.filter(row=>row["KW Nr."]===latestWeek&&n(row[metric])!==null);
  const ranked=latestRows
    .map(row=>({label:row.Land,value:n(row[metric])}))
    .sort((a,b)=>b.value-a.value)
    .slice(0,8);

  landTopTitle.textContent=`Top-Länder · ${config.label}`;
  landTrendTitle.textContent=`Entwicklung · ${config.label}`;
  landHeatmapTitle.textContent=`Heatmap · ${config.label} · 10‑Wochen-Fenster`;
  landAverageTitle.textContent=`Heatmap · Ø ${config.label} · 10 Wochen`;

  landTopSub.textContent=`Letzte verfügbare Woche KW${String(latestWeek).padStart(2,"0")}`;
  barChart("landBarChart",ranked.map((item,index)=>({
    ...item,
    formatted:formatLandMetric(item.value,config.type),
    color:colors[index%colors.length]
  })),{tick:value=>config.type==="price"?fmt0.format(value):fmtNum.format(value)+" %"});

  const top5=averages.slice(0,5);
  landTrendSub.textContent=`Top 5 nach Durchschnitt · Fenster bis KW${String(endWeek).padStart(2,"0")}`;
  lineChart("landTrendChart",presentWeeks.map(week=>`KW${String(week).padStart(2,"0")}`),top5.map(item=>({
    name:item.land,
    values:presentWeeks.map(week=>{
      const row=item.rows.find(entry=>entry["KW Nr."]===week);
      return n(row?.[metric]);
    }),
    format:value=>formatLandMetric(value,config.type)
  })),{zero:config.zero,tick:value=>config.type==="price"?fmt0.format(value):fmtNum.format(value)+" %"});

  const allValues=records.map(row=>n(row[metric])).filter(value=>value!==null);
  const min=allValues.length?Math.min(...allValues):0;
  const max=allValues.length?Math.max(...allValues):1;
  const countries=[...new Set(records.map(row=>row.Land))];

  landHeatmapSub.textContent=`${config.label} · verfügbare Wochen bis Referenz-KW${String(endWeek).padStart(2,"0")}`;
  landTable.innerHTML=`<thead><tr>
    <th>Land</th>
    ${presentWeeks.map(week=>`<th>KW${String(week).padStart(2,"0")}</th>`).join("")}
    <th>Ø 10W</th><th>Δ Start→Ende</th>
  </tr></thead><tbody>${countries.map(country=>{
    const countryRows=records.filter(row=>row.Land===country);
    const values=presentWeeks.map(week=>{
      const row=countryRows.find(entry=>entry["KW Nr."]===week);
      return n(row?.[metric]);
    });
    const valid=values.filter(value=>value!==null);
    const avg=valid.length?valid.reduce((sum,value)=>sum+value,0)/valid.length:null;
    const delta=valid.length>1?valid[valid.length-1]-valid[0]:null;
    return `<tr>
      <td>${esc(country)}</td>
      ${values.map(value=>`<td style="background:${landHeatColor(value,min,max)}">${formatLandMetric(value,config.type)}</td>`).join("")}
      <td style="background:${landHeatColor(avg,min,max)}">${formatLandMetric(avg,config.type)}</td>
      <td>${delta===null?"–":formatLandMetric(delta,config.type)}</td>
    </tr>`;
  }).join("")}</tbody>`;

  const avgValues=averages.map(item=>item.avg);
  const avgMin=avgValues.length?Math.min(...avgValues):0;
  const avgMax=avgValues.length?Math.max(...avgValues):1;
  landAverageSub.textContent=`Durchschnitt ${config.label} über bis zu 10 verfügbare Wochen`;
  landAverageTable.innerHTML=`<thead><tr>
    <th>Land</th><th>Ø 10W</th><th>Letzter Wert</th><th>Δ letzter Wert zu Ø</th><th>Datenwochen</th>
  </tr></thead><tbody>${averages.map(item=>{
    const delta=item.latest!==null&&item.avg!==null?item.latest-item.avg:null;
    return `<tr>
      <td>${esc(item.land)}</td>
      <td style="background:${landHeatColor(item.avg,avgMin,avgMax)}">${formatLandMetric(item.avg,config.type)}</td>
      <td style="background:${landHeatColor(item.latest,avgMin,avgMax)}">${formatLandMetric(item.latest,config.type)}</td>
      <td>${delta===null?"–":formatLandMetric(delta,config.type)}</td>
      <td>${item.count}/10</td>
    </tr>`;
  }).join("")}</tbody>`;
}
function landCountryColor(index){
  return colors[index%colors.length]||"#54714F";
}
function landAllRowsForWeeks(weeks){
  const allowed=new Set(weeks);
  return (DATA.countryComparison||[])
    .filter(row=>allowed.has(Number(row["KW Nr."])));
}
function landLinearRegression(values){
  const points=values.map((value,index)=>({x:index,y:value}))
    .filter(point=>point.y!==null&&Number.isFinite(point.y));
  if(points.length<2)return {slope:0,intercept:points[0]?.y??0,first:points[0]?.y??null,last:points[0]?.y??null};
  const xAvg=points.reduce((sum,p)=>sum+p.x,0)/points.length;
  const yAvg=points.reduce((sum,p)=>sum+p.y,0)/points.length;
  const numerator=points.reduce((sum,p)=>sum+(p.x-xAvg)*(p.y-yAvg),0);
  const denominator=points.reduce((sum,p)=>sum+(p.x-xAvg)**2,0);
  const slope=denominator?numerator/denominator:0;
  const intercept=yAvg-slope*xAvg;
  const first=intercept+slope*points[0].x;
  const last=intercept+slope*points[points.length-1].x;
  return {slope,intercept,first,last};
}
function landSparklineSvg(values,regression,color){
  const width=260,height=78,padX=8,padY=10;
  const valid=values.filter(value=>value!==null&&Number.isFinite(value));
  if(!valid.length)return "";
  const trendValues=values.map((_,index)=>regression.intercept+regression.slope*index);
  const all=[...valid,...trendValues.filter(Number.isFinite)];
  let min=Math.min(...all),max=Math.max(...all);
  if(min===max){min-=1;max+=1}
  const x=index=>padX+(values.length<=1?0:index*(width-padX*2)/(values.length-1));
  const y=value=>height-padY-(value-min)*(height-padY*2)/(max-min);
  const segments=[];
  let current=[];
  values.forEach((value,index)=>{
    if(value===null||!Number.isFinite(value)){
      if(current.length){segments.push(current);current=[]}
    }else current.push(`${x(index).toFixed(1)},${y(value).toFixed(1)}`);
  });
  if(current.length)segments.push(current);
  const actual=segments.map(points=>`<polyline points="${points.join(" ")}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`).join("");
  const trend=`<line x1="${x(0)}" y1="${y(trendValues[0])}" x2="${x(values.length-1)}" y2="${y(trendValues[trendValues.length-1])}" stroke="${color}" stroke-width="1.4" stroke-dasharray="5 4" opacity=".62"/>`;
  const dots=values.map((value,index)=>value===null||!Number.isFinite(value)?"":`<circle cx="${x(index)}" cy="${y(value)}" r="${index===0||index===values.length-1?3.2:0}" fill="white" stroke="${color}" stroke-width="2"/>`).join("");
  return `<svg class="land-spark-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">${trend}${actual}${dots}</svg>`;
}
function renderLandRangeView(endWeek,metric){
  const effectiveMetric=metric==="land"?"Ø-Preis Gesamt":metric;
  const config=landMetricConfig(effectiveMetric);
  const requestedWeeks=Array.from({length:10},(_,index)=>endWeek-9+index).filter(week=>week>0);
  const availableWeeks=requestedWeeks.filter(week=>availableDashboardWeeks().includes(week));
  const records=landAllRowsForWeeks(availableWeeks);
  const countries=[...new Set(records.map(row=>row.Land))];
  const summaries=countries.map((country,index)=>{
    const rows=records.filter(row=>row.Land===country).sort((a,b)=>a["KW Nr."]-b["KW Nr."]);
    const values=rows.map(row=>n(row[effectiveMetric])).filter(value=>value!==null);
    if(!values.length)return null;
    return {
      country,index,values,count:values.length,
      min:Math.min(...values),max:Math.max(...values),
      avg:values.reduce((sum,value)=>sum+value,0)/values.length
    };
  }).filter(Boolean).sort((a,b)=>b.avg-a.avg);

  landRangeTitle.textContent=`${config.label} · Von–Bis und Durchschnitt`;
  landRangeSub.textContent=`KW ${String(endWeek-9).padStart(2,"0")}–${String(endWeek).padStart(2,"0")} · Mittel je Land über das 10‑Wochen-Fenster`;
  landRangeChip.textContent=`${availableWeeks.length}/10 Wochen verfügbar`;

  if(!summaries.length){
    landRangeList.innerHTML='<div class="land-spark-empty">Keine Werte im gewählten Fenster verfügbar.</div>';
    landRangeAxis.innerHTML="";
    landRangeNote.textContent="";
    return;
  }

  let globalMin=Math.min(...summaries.map(item=>item.min));
  let globalMax=Math.max(...summaries.map(item=>item.max));
  if(globalMin===globalMax){globalMin-=1;globalMax+=1}
  const position=value=>Math.max(0,Math.min(100,(value-globalMin)/(globalMax-globalMin)*100));

  landRangeList.innerHTML=summaries.map((item,index)=>{
    const color=landCountryColor(index);
    const left=position(item.min),right=position(item.max),average=position(item.avg);
    return `<div class="land-range-row">
      <div class="land-range-country">
        <span class="land-country-dot" style="background:${color}"></span>
        <span>${esc(item.country)}</span>
      </div>
      <div class="land-range-plot">
        <div class="land-range-track">
          <div class="land-range-base" style="left:${left}%;width:${Math.max(.5,right-left)}%;background:${color}"></div>
          <div class="land-range-average" style="left:${average}%;background:${color}"></div>
        </div>
        <div class="land-range-values">
          <strong style="color:${color}">${formatLandMetric(item.avg,config.type)}</strong>
          <span>· ${formatLandMetric(item.min,config.type).replace(/\s/g,"")}–${formatLandMetric(item.max,config.type).replace(/\s/g,"")}</span>
        </div>
      </div>
    </div>`;
  }).join("");

  const ticks=Array.from({length:5},(_,index)=>globalMin+(globalMax-globalMin)*index/4);
  landRangeAxis.innerHTML=`<span></span><div class="land-range-axis-scale">${
    ticks.map((value,index)=>`<span class="land-range-axis-tick" style="left:${index*25}%">${config.type==="price"?fmt0.format(value):fmtNum.format(value)}</span>`).join("")
  }</div>`;

  landRangeNote.innerHTML=`● Mittelwert der verfügbaren Wochenwerte &nbsp;&nbsp; ▬ Spanne Min–Max.
    Länder ohne Werte für <strong>${esc(config.label)}</strong> entfallen. Die Mittelwerte sind ungewichtet.`;
}
function renderLandSparkView(endWeek,metric){
  const effectiveMetric=metric==="land"?"Ø-Preis Gesamt":metric;
  const config=landMetricConfig(effectiveMetric);
  const requestedWeeks=Array.from({length:20},(_,index)=>endWeek-19+index).filter(week=>week>0);
  const availableWeeks=requestedWeeks.filter(week=>availableDashboardWeeks().includes(week));
  const records=landAllRowsForWeeks(availableWeeks);
  const countries=[...new Set(records.map(row=>row.Land))];

  const summaries=countries.map((country,index)=>{
    const rows=records.filter(row=>row.Land===country);
    const values=availableWeeks.map(week=>{
      const row=rows.find(entry=>entry["KW Nr."]===week);
      return n(row?.[effectiveMetric]);
    });
    const valid=values.filter(value=>value!==null);
    if(valid.length<3)return null;
    const regression=landLinearRegression(values);
    const trendAbs=regression.last-regression.first;
    const trendPct=regression.first?trendAbs/Math.abs(regression.first):null;
    const avg=valid.reduce((sum,value)=>sum+value,0)/valid.length;
    return {country,index,values,validCount:valid.length,regression,trendAbs,trendPct,avg};
  }).filter(Boolean).sort((a,b)=>(b.trendPct??-Infinity)-(a.trendPct??-Infinity));

  landSparkTitle.textContent=`${config.label} · Sparklines und Trend`;
  landSparkSub.textContent=`KW ${String(endWeek-19).padStart(2,"0")}–${String(endWeek).padStart(2,"0")} · Wochenverlauf und lineare Trendlinie`;
  landSparkChip.textContent=`${availableWeeks.length}/20 Wochen verfügbar`;

  if(!summaries.length){
    landSparkGrid.innerHTML='<div class="land-spark-empty">Keine Länder mit mindestens drei verfügbaren Wochenwerten.</div>';
    landSparkNote.textContent="";
    return;
  }

  landSparkGrid.innerHTML=summaries.map((item,index)=>{
    const color=landCountryColor(index);
    const pct=item.trendPct;
    const status=pct!==null&&pct>=.015?"up":pct!==null&&pct<=-.015?"down":"";
    const arrow=status==="up"?"▲":status==="down"?"▼":"–";
    const trendPctText=pct===null?"–":`${pct>=0?"+":""}${fmtNum.format(pct*100)} %`;
    const trendAbsText=`${item.trendAbs>=0?"+":""}${formatLandMetric(item.trendAbs,config.type)}`;
    return `<article class="land-spark-item">
      <div class="land-spark-header">
        <div class="land-spark-country">
          <span class="land-country-dot" style="background:${color}"></span>
          <span title="${esc(item.country)}">${esc(item.country)}</span>
        </div>
        <span class="land-trend-badge ${status}">${arrow} ${trendPctText}</span>
      </div>
      ${landSparklineSvg(item.values,item.regression,color)}
      <div class="land-spark-stats">
        <span>Ø <strong>${formatLandMetric(item.avg,config.type)}</strong></span>
        <span>Trend <strong>${trendAbsText}</strong></span>
        <span>${item.validCount} Wo.</span>
      </div>
    </article>`;
  }).join("");

  landSparkNote.innerHTML=`Trend = lineare Regression über die verfügbaren Wochenwerte; gestrichelte Linie.
    ▲ ab +1,5 %, ▼ ab −1,5 %, sonst stabil. Jede Sparkline wird unabhängig skaliert.`;
}
function setLandDisplayMode(mode){
  const selected=mode||landDisplayMode.value||"overview";
  landOverviewView.hidden=selected!=="overview";
  landRangeView.hidden=selected!=="range";
  landSparkView.hidden=selected!=="sparklines";
}

function renderLand(){
  if(!document.getElementById("landMetricSelect"))return;
  const endWeek=ensureLandEndWeekOptions();
  const displayMode=landDisplayMode.value||"overview";
  setLandDisplayMode(displayMode);
  const allWeeks=availableDashboardWeeks();
  const windowWeeks=Array.from({length:10},(_,index)=>endWeek-9+index).filter(week=>week>0);
  const presentWeeks=windowWeeks.filter(week=>allWeeks.includes(week));
  const records=landComparisonRowsForWindow(presentWeeks);

  if(!presentWeeks.length||!records.length){
    landTopSub.textContent=`Keine Wochenberichte im 10‑Wochen-Fenster bis KW${String(endWeek).padStart(2,"0")}.`;
    landTrendSub.textContent="Keine Daten";
    landHeatmapSub.textContent="Keine Daten";
    landAverageSub.textContent="Keine Daten";
    landBarChart.innerHTML="";
    landTrendChart.innerHTML="";
    landTable.innerHTML="<tbody><tr><td>Keine Daten verfügbar.</td></tr></tbody>";
    landAverageTable.innerHTML="<tbody><tr><td>Keine Daten verfügbar.</td></tr></tbody>";
    if(displayMode==="range"){
      landRangeList.innerHTML='<div class="land-spark-empty">Keine Daten verfügbar.</div>';
      landRangeAxis.innerHTML="";
    }
    if(displayMode==="sparklines"){
      landSparkGrid.innerHTML='<div class="land-spark-empty">Keine Daten verfügbar.</div>';
    }
    return;
  }

  const metric=landMetricSelect.value||"land";
  if(displayMode==="range"){
    renderLandRangeView(endWeek,metric);
    return;
  }
  if(displayMode==="sparklines"){
    renderLandSparkView(endWeek,metric);
    return;
  }
  if(metric==="land")renderLandOverview(records,presentWeeks,endWeek);
  else renderLandMetric(records,presentWeeks,endWeek,metric);
}
function countryComparisonRows(week){
  return (DATA.countryComparison||[])
    .filter(row=>row["KW Nr."]===Number(week))
    .sort((a,b)=>(n(b["M%"])||0)-(n(a["M%"])||0));
}
function countryValueLeader(rows,field,{excludeNir=false}={}){
  const valid=rows.filter(row=>{
    if(excludeNir&&row.Land==="NIR")return false;
    return n(row[field])!==null;
  });
  return valid.sort((a,b)=>n(b[field])-n(a[field]))[0]||null;
}

function derivedSwPrice(row){
  const total=n(row["Ø-Preis Gesamt"]);
  const hw=n(row["Ø-Preis HW-Säge"]);
  const hwShare=n(row["M% HW-Säge"]);
  const swShare=n(row["M% SW"]);
  if(total===null||hw===null||swShare===null||swShare<=0)return null;
  const hwFraction=hwShare===null?0:hwShare/100;
  const swFraction=swShare/100;
  if(swFraction<=0)return null;
  const derived=(total-(hwFraction*hw))/swFraction;
  return Number.isFinite(derived)?derived:null;
}

function countryCompareKpi(label,row,field,type,meta=""){
  return `<article class="country-compare-kpi detail-kpi">
    <small class="detail-kpi-label">${esc(label)}</small>
    <strong title="${esc(row?`${row.Land} · ${format(row[field],type)}`:"–")}">${row?esc(row.Land):"–"}</strong>
    <span>${row?format(row[field],type):"Keine Daten"}${meta?` · ${esc(meta)}`:""}</span>
  </article>`;
}
function renderCountryComparison(){
  if(!document.getElementById("countryCompareWeek"))return;
  const week=Number(countryCompareWeek.value)||Math.max(...availableDashboardWeeks());
  const rows=countryComparisonRows(week);
  const visibleRows=rows.filter(row=>row.Land!=="NIR");
  const source=rows[0]?.Quelldatei||`KW-${String(week).padStart(2,"0")}-2026.xlsx`;
  countryCompareSource.textContent=`${source} · KW${String(week).padStart(2,"0")}`;

  const largest=countryValueLeader(rows,"M%",{excludeNir:true});
  const highestTotalPrice=countryValueLeader(rows,"Ø-Preis Gesamt");
  const highestHwPrice=countryValueLeader(rows,"Ø-Preis HW-Säge");
  const highestSw=countryValueLeader(rows,"M% SW");

  countryCompareKpis.innerHTML=[
    countryCompareKpi("Größter Markt",largest,"M%","pctpoint","Mengenanteil"),
    countryCompareKpi("Höchster Gesamtpreis",highestTotalPrice,"Ø-Preis Gesamt","price"),
    countryCompareKpi("Höchster HW-Preis",highestHwPrice,"Ø-Preis HW-Säge","price"),
    countryCompareKpi("Höchster SW-Anteil",highestSw,"M% SW","pctpoint")
  ].join("");

  const ranked=visibleRows.filter(row=>(n(row["M%"])||0)>0).slice(0,10);
  countryShareCompareSub.textContent=`KW${String(week).padStart(2,"0")} · Mengenanteil in Prozent`;
  barChart("countryShareCompareChart",ranked.map((row,index)=>({
    label:row.Land,value:n(row["M%"])||0,
    formatted:format(row["M%"],"pctpoint"),color:colors[index%colors.length]
  })),{tick:value=>fmtNum.format(value)+" %"});

  const priceRows=visibleRows.filter(row=>
    n(row["Ø-Preis Gesamt"])!==null||
    n(row["Ø-Preis HW-Säge"])!==null||
    derivedSwPrice(row)!==null
  );
  countryPriceCompareSub.textContent=`KW${String(week).padStart(2,"0")} · €/m³ · HW, SW (abgeleitet) und Gesamt`;
  lineChart("countryPriceCompareChart",priceRows.map(row=>row.Land),[
    {name:"Ø-Preis HW-Säge",values:priceRows.map(row=>n(row["Ø-Preis HW-Säge"])),format:value=>format(value,"price")},
    {name:"Ø-Preis SW",values:priceRows.map(row=>derivedSwPrice(row)),format:value=>format(value,"price")},
    {name:"Ø-Preis Gesamt",values:priceRows.map(row=>n(row["Ø-Preis Gesamt"])),format:value=>format(value,"price")}
  ],{zero:false,tick:value=>fmt0.format(value)});

  const mixRows=visibleRows.filter(row=>n(row["M% HW-Säge"])!==null||n(row["M% SW"])!==null);
  countryMixChart.innerHTML=`<div class="country-mix-legend"><span class="hw">Hauptware Säge</span><span class="sw">Seitenware</span></div>${
    mixRows.map(row=>{
      const hw=Math.max(0,Math.min(100,n(row["M% HW-Säge"])||0));
      const sw=Math.max(0,Math.min(100,n(row["M% SW"])||0));
      return `<div class="country-mix-row">
        <div class="country-mix-name" title="${esc(row.Land)}">${esc(row.Land)}</div>
        <div class="country-mix-track" title="HW ${fmtNum.format(hw)} % · SW ${fmtNum.format(sw)} %">
          <div class="country-mix-hw" style="width:${hw}%"></div>
          <div class="country-mix-sw" style="width:${sw}%"></div>
        </div>
        <div class="country-mix-values">${fmtNum.format(hw)} / ${fmtNum.format(sw)} %</div>
      </div>`;
    }).join("")
  }`;

  const selectedCountry=countryCompareCountry.value||visibleRows[0]?.Land||"FRANKREICH";
  const countryHistory=(DATA.countryComparison||[])
    .filter(row=>row.Land===selectedCountry)
    .sort((a,b)=>a["KW Nr."]-b["KW Nr."]);
  const labels=countryHistory.map(row=>row.KW);

  countryTrendSub.textContent=`${selectedCountry} · Mengenanteil und Produktmix`;
  lineChart("countryShareTrendChart",labels,[
    {name:"Mengenanteil",values:countryHistory.map(row=>n(row["M%"])),format:value=>format(value,"pctpoint")},
    {name:"HW-Säge",values:countryHistory.map(row=>n(row["M% HW-Säge"])),format:value=>format(value,"pctpoint")},
    {name:"Seitenware",values:countryHistory.map(row=>n(row["M% SW"])),format:value=>format(value,"pctpoint")}
  ],{zero:true,tick:value=>fmtNum.format(value)+" %"});

  countryPriceTrendSub.textContent=`${selectedCountry} · Preisentwicklung in €/m³`;
  lineChart("countryPriceTrendChart",labels,[
    {name:"Ø-Preis HW-Säge",values:countryHistory.map(row=>n(row["Ø-Preis HW-Säge"])),format:value=>format(value,"price")},
    {name:"Ø-Preis Gesamt",values:countryHistory.map(row=>n(row["Ø-Preis Gesamt"])),format:value=>format(value,"price")}
  ],{zero:false,tick:value=>fmt0.format(value)});

  countryCompareTable.innerHTML=`<thead><tr>
    <th>Land</th>
    <th>M%</th>
    <th>M%<br>HW-Säge</th>
    <th>M% SW</th>
    <th>Ø-Preis<br>HW-Säge</th>
    <th>Ø-Preis<br>SW</th>
    <th>Ø-Preis<br>Gesamt</th>
  </tr></thead><tbody>${rows.map(row=>`<tr>
    <td>${esc(row.Land)}</td>
    <td>${format(row["M%"],"pctpoint")}</td>
    <td>${format(row["M% HW-Säge"],"pctpoint")}</td>
    <td>${format(row["M% SW"],"pctpoint")}</td>
    <td>${format(row["Ø-Preis HW-Säge"],"price")}</td>
    <td>${format(derivedSwPrice(row),"price")}</td>
    <td>${format(row["Ø-Preis Gesamt"],"price")}</td>
  </tr>`).join("")}</tbody>`;
}

function renderDetails(){
  const order=selectedByWeek(DATA.orderWindow),labels=order.map(r=>r.KW);
  lineChart("orderChart",labels,[
    {name:"4W Bestand",values:order.map(r=>n(r["4W gemeldet"])),format:v=>format(v,"m3")},
    {name:"8W Bestand",values:order.map(r=>n(r["8W Gesamt"])),format:v=>format(v,"m3")},
    {name:"Lagerbestand",values:order.map(r=>n(r.Lagerbestand)),format:v=>format(v,"m3")}
  ],{tick:v=>fmt0.format(v)});
  const ship=selectedByWeek(DATA.shipments);
  lineChart("shipChart",ship.map(r=>r.KW),[
    {name:"Gesamt",values:ship.map(r=>n(r["Gesamt gemeldet"])),format:v=>fmt0.format(v)},
    {name:"Ø/Tag",values:ship.map(r=>n(r["Ø gemeldet"])),format:v=>fmt0.format(v)}
  ],{zero:true,tick:v=>fmt0.format(v)});
  renderTable("orderTable",order,[["KW","text"],["4W berechnet","number"],["4W gemeldet","number"],["Abweichung","number"],["Reserv.% gem.","number"],["+/- gemeldet","number"],["+/- ggü. Vorwoche","number"],["Lagerbestand","number"],["Hinweis","text"]]);
  renderTable("dryingTable",selectedByWeek(DATA.drying,"Berichts-KW"),[["Berichts-KW","text"],["Ziel-KW 1","text"],["Wert 1","number"],["Zusatzwert 1","number"],["Ziel-KW 2","text"],["Wert 2","number"],["Zusatzwert 2","number"],["Ziel-KW 3","text"],["Wert 3","number"],["Zusatzwert 3","number"],["Prüfhinweis","text"]]);
  renderTable("shipmentTable",ship,[["KW","text"],["Mo","number"],["Di","number"],["Mi","number"],["Do","number"],["Fr","number"],["Gesamt gemeldet","number"],["aktive Tage","number"],["Ø gemeldet","number"]]);
}
const KPI_LAYOUT_KEY="kwDashboardCustomKpiLayoutV2";
let customKpis=[];
let topZ=10;

function metricTypeFromName(key){
  const k=String(key);
  if(k.includes("Reservierungsquote"))return "percent";
  if(k.includes("€/m³")||k.includes("Ø Preis"))return "price";
  if(k.includes("(€)")||k.includes("DB Netto"))return "currency";
  if(k.includes("(m³)"))return "m3";
  if(k.includes("(fm)"))return "fm";
  return "number";
}
function inferMetricType(key){
  const k=String(key||"");
  if(k.includes("Reservierungsquote")||k.includes("Diff. %")||k.includes("Quote"))return "percent";
  if(k==="M%"||k.includes("Reserv.%")||k.includes("Ausbeute")||k.includes("Störzeit"))return "pctpoint";
  if(k.includes("€/m³")||k.includes("Ø Preis")||k.includes("Preis"))return "price";
  if(k.includes("(€)")||k.includes("DB Netto"))return "currency";
  if(k.includes("m³/min"))return "m3min";
  if(k.includes("fm/min"))return "fmmin";
  if(k.includes("Produktionszeit")||k.includes("Sägezeit")||k.includes("min"))return "minutes";
  if(k.includes("LAUFMETER"))return "lfm";
  if(k.includes("STÜCKZAHL"))return "pieces";
  if(k.includes("(m³)")||k.includes(" m³")||k.includes("Wert"))return "m3";
  if(k.includes("(fm)")||k.includes(" fm")||k.includes("RHP")||k.includes("Säge")||k.includes("Gatter"))return "fm";
  return "number";
}
function catalogWeeksFromWideRow(row){
  return availableDashboardWeeks().map(week=>({week,value:n(row?.[`KW${week}`])}));
}
function datasetSeries(rows,weekField,valueField,filterFn=()=>true){
  return rows.filter(filterFn).map(row=>({
    week:weekNo(row[weekField]),
    value:n(row[valueField]),
    row
  })).filter(point=>Number.isFinite(point.week)).sort((a,b)=>a.week-b.week);
}
/* ---------- Einkauf (Einkauf.xlsx) ---------- */
function purchasingRowsActive(){
  return (DATA.purchasing||[]).slice().sort((a,b)=>Number(a.week)-Number(b.week));
}
function purchasingAvgPreis(row){
  const netto=n(row?.netto),fm=n(row?.fmGekauft);
  return (netto!==null&&fm)?netto/fm:null;
}
function weeklyRevenue(row){
  const menge=n(row?.["Umsatzmenge gesamt (m³)"]),preis=n(row?.["Ø Preis gesamt (€/m³)"]);
  return (menge!==null&&preis!==null)?menge*preis:null;
}
/* Gemeinsame Wochen von Umsatz (Wochenbericht) und Einkauf (fm geliefert) des aktiven Jahres. */
function purchasingSalesSeries(){
  const map=new Map();
  (DATA.purchasing||[]).forEach(row=>map.set(Number(row.week),row));
  return (DATA.weekly||[]).map(row=>{
    const week=Number(row["KW Nr."]);
    const purchase=map.get(week);
    const umsatz=weeklyRevenue(row);
    const fmGeliefert=purchase?n(purchase.fmGeliefert):null;
    const ratio=(umsatz!==null&&fmGeliefert!==null&&fmGeliefert!==0)?umsatz/fmGeliefert:null;
    return {week,umsatz,fmGeliefert,ratio};
  }).filter(point=>Number.isFinite(point.week)).sort((a,b)=>a.week-b.week);
}
/* Auf das gewählte Zeitfenster eingeschränkte gemeinsame Wochen (für Kombi-Statistikmodule). */
function comboWindowedPoints(item){
  let points=purchasingSalesSeries().filter(point=>point.ratio!==null);
  const period=String(item.period);
  if(period==="free"){
    const w=statisticsFreeWindowOf(item),lo=Math.min(w.fromWeek,w.toWeek),hi=Math.max(w.fromWeek,w.toWeek);
    points=points.filter(point=>point.week>=lo&&point.week<=hi);
  }else if(period==="yoy"){
    points=points.filter(point=>point.week<=Number(item.endWeek));
  }else{
    const limit=Number(period)||points.length;
    points=points.filter(point=>point.week<=Number(item.endWeek)).slice(-limit);
  }
  return points;
}
function statisticsComboSummary(item){
  const points=comboWindowedPoints(item);
  const ratios=points.map(point=>point.ratio).filter(value=>value!==null&&Number.isFinite(value));
  const latest=points.length?points.at(-1).ratio:null;
  const first=ratios.length?ratios[0]:null;
  const umsatzSum=points.reduce((sum,point)=>sum+(point.umsatz||0),0);
  const fmSum=points.reduce((sum,point)=>sum+(point.fmGeliefert||0),0);
  const change=(latest!==null&&first!==null)?latest-first:null;
  const changePct=first?change/Math.abs(first):null;
  return {points,latest,avg:statisticsAverage(ratios),change,changePct,umsatzSum,fmSum,weighted:fmSum?umsatzSum/fmSum:null};
}

function kpiCatalog(){
  const entries=[];
  const add=entry=>entries.push(entry);

  const excludedWeekly=new Set(["KW","KW Nr.","Quelldatei"]);
  Object.keys(DATA.weekly[0]||{}).forEach(key=>{
    if(excludedWeekly.has(key)||!DATA.weekly.some(row=>typeof row[key]==="number"))return;
    add({
      id:key,label:key,group:"Übersicht & Haupt-KPIs",mode:"numeric",
      type:metricTypeFromName(key),
      series:()=>DATA.weekly.map(row=>({week:row["KW Nr."],value:n(row[key]),row})).sort((a,b)=>a.week-b.week)
    });
  });

  const salesCategories=[...new Set(DATA.salesBreakdown.map(row=>row.Kategorie))];
  salesCategories.forEach(category=>{
    add({
      id:`sales-card::${category}`,label:`${category} · vollständige Umsatzkarte`,
      group:"Umsatz – Produktkarten",mode:"sales-card",type:"m3",
      series:()=>datasetSeries(DATA.salesBreakdown,"KW","Menge (m³)",row=>row.Kategorie===category)
    });
    [
      ["Menge (m³)","m3"],["EUR (€/m³)","price"],["M%","pctpoint"]
    ].forEach(([field,type])=>add({
      id:`sales::${category}::${field}`,label:`${category} · ${field}`,
      group:"Umsatz – Einzelwerte",mode:"numeric",type,
      series:()=>datasetSeries(DATA.salesBreakdown,"KW",field,row=>row.Kategorie===category)
    }));
  });

  [...new Set(DATA.productionCurrent.map(row=>row.Kennzahl))].forEach(metric=>{
    const sample=DATA.productionCurrent.find(row=>row.Kennzahl===metric);
    add({
      id:`production-card::${metric}`,label:`${metric} · aktuelle Produktion`,
      group:"Produktion – Aktuell",mode:"production-card",
      type:sample?.Einheit==="m³"?"m3":"fm",
      series:()=>datasetSeries(DATA.productionCurrent,"KW","Aktuell",row=>row.Kennzahl===metric)
    });
  });

  const sawMetrics=[...new Set(DATA.sawlineReports.map(row=>row.KPI))];
  sawMetrics.forEach(metric=>{
    const sample=DATA.sawlineReports.find(row=>row.KPI===metric);
    add({
      id:`sawline-card::${metric}`,label:`${metric} · vollständige Wochenkarte`,
      group:"Sägelinie – Wochenkarten",mode:"sawline-card",
      type:sample?.Werttyp||inferMetricType(metric),
      series:()=>datasetSeries(DATA.sawlineReports,"KW","Summe",row=>row.KPI===metric)
    });
    ["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Summe"].forEach(day=>{
      add({
        id:`sawline::${metric}::${day}`,label:`${metric} · ${day}`,
        group:"Sägelinie – Tageswerte",mode:"numeric",
        type:sample?.Werttyp||inferMetricType(metric),
        series:()=>datasetSeries(DATA.sawlineReports,"KW",day,row=>row.KPI===metric)
      });
    });
  });

  DATA.landShares.forEach(row=>add({
    id:`country-share::${row.Land}`,label:`${row.Land} · Mengenanteil`,
    group:"Länder – Mengenanteile",mode:"numeric",type:"pctpoint",
    series:()=>catalogWeeksFromWideRow(row)
  }));
  DATA.landPrices.forEach(row=>add({
    id:`country-price::${row.Land}`,label:`${row.Land} · Ø Preis Gesamt`,
    group:"Länder – Preise",mode:"numeric",type:"price",
    series:()=>catalogWeeksFromWideRow(row)
  }));
  [...new Set((DATA.countryComparison||[]).map(row=>row.Land))].forEach(country=>{
    [
      ["M% HW-Säge","pctpoint","Länder – Produktmix"],
      ["M% SW","pctpoint","Länder – Produktmix"],
      ["Ø-Preis HW-Säge","price","Länder – Preise"]
    ].forEach(([field,type,group])=>add({
      id:`country-compare::${country}::${field}`,
      label:`${country} · ${field}`,
      group,mode:"numeric",type,
      series:()=>datasetSeries(DATA.countryComparison||[],"KW",field,row=>row.Land===country)
    }));
  });

  const ytdExcluded=new Set(["KW"]);
  Object.keys(DATA.ytd[0]||{}).forEach(field=>{
    if(ytdExcluded.has(field)||!DATA.ytd.some(row=>typeof row[field]==="number"))return;
    add({
      id:`ytd::${field}`,label:field,group:"YTD – Produktion",mode:"numeric",
      type:inferMetricType(field),
      series:()=>datasetSeries(DATA.ytd,"KW",field)
    });
  });

  const orderExcluded=new Set(["KW","Status 4W","Status +/-","Quelldatei","Hinweis"]);
  Object.keys(DATA.orderWindow[0]||{}).forEach(field=>{
    if(orderExcluded.has(field)||!DATA.orderWindow.some(row=>typeof row[field]==="number"))return;
    add({
      id:`order::${field}`,label:field,group:"Auftrag & Bestand",mode:"numeric",
      type:field.includes("%")||field.includes("Quote")?"pctpoint":field.includes("Lager")||field.includes("4W")||field.includes("8W")||field.includes("+/-")?"m3":"number",
      series:()=>datasetSeries(DATA.orderWindow,"KW",field)
    });
  });

  ["Wert 1","Zusatzwert 1","Wert 2","Zusatzwert 2","Wert 3","Zusatzwert 3","Summe Hauptspalte"].forEach(field=>{
    if(!DATA.drying.some(row=>typeof row[field]==="number"))return;
    add({
      id:`drying::${field}`,label:`Trocknung · ${field}`,group:"Trocknung",mode:"numeric",type:"m3",
      series:()=>datasetSeries(DATA.drying,"Berichts-KW",field)
    });
  });

  ["Mo","Di","Mi","Do","Fr","Summe Tage","Gesamt gemeldet","Abweichung","aktive Tage","Ø gerechnet","Ø gemeldet"].forEach(field=>{
    if(!DATA.shipments.some(row=>typeof row[field]==="number"))return;
    add({
      id:`shipments::${field}`,label:`Verladungen · ${field}`,group:"Verladungen",mode:"numeric",type:"number",
      series:()=>datasetSeries(DATA.shipments,"KW",field)
    });
  });

  DATA.areaSummary.forEach(row=>add({
    id:`quality-card::${row.Bereich}`,label:`${row.Bereich} · Datenqualität`,
    group:"Datenqualität",mode:"quality-card",type:"number",
    staticRow:row,series:()=>[]
  }));

  // Einkauf (Stammdaten des im Kopf gewählten Jahres)
  const purchasingMetrics=[
    ["einkauf::netto","Einkaufswert netto (€)","currency",row=>n(row.netto)],
    ["einkauf::fmGekauft","fm gekauft","fm",row=>n(row.fmGekauft)],
    ["einkauf::fmGeliefert","fm geliefert","fm",row=>n(row.fmGeliefert)],
    ["einkauf::avgPreis","Ø Einkaufspreis (€/fm)","pricefm",row=>purchasingAvgPreis(row)]
  ];
  purchasingMetrics.forEach(([id,label,type,pick])=>add({
    id,label,group:"Einkauf",mode:"numeric",type,
    series:()=>(DATA.purchasing||[]).map(row=>({week:Number(row.week),value:pick(row)})).filter(point=>Number.isFinite(point.week)).sort((a,b)=>a.week-b.week)
  }));

  // Einkauf ↔ Umsatz: Umsatz je gelieferten Festmeter (Verhältnis Verkauf/Einkauf) und Bausteine
  add({
    id:"combo::umsatzErloes",label:"Umsatz gesamt (€/KW)",group:"Einkauf ↔ Umsatz",mode:"numeric",type:"currency",
    series:()=>purchasingSalesSeries().map(point=>({week:point.week,value:point.umsatz})).filter(point=>point.value!==null)
  });
  add({
    id:"combo::umsatz-fmgeliefert",label:"Umsatz je fm geliefert (€/fm)",group:"Einkauf ↔ Umsatz",mode:"combo",type:"pricefm",
    series:()=>purchasingSalesSeries().map(point=>({week:point.week,value:point.ratio})).filter(point=>point.value!==null)
  });

  return entries;
}
function availableMetrics(){
  return kpiCatalog().map(entry=>entry.id);
}
function resolveKpiDefinition(metric){
  const catalog=kpiCatalog();
  return catalog.find(entry=>entry.id===metric)||
    catalog.find(entry=>entry.label===metric)||
    catalog.find(entry=>entry.id===String(metric).replace(/^weekly::/,""))||
    null;
}
function metricOptionMarkup(selectedMetric="",groupFilter=null){
  const entries=kpiCatalog().filter(entry=>!groupFilter||entry.group===groupFilter);
  const groups=[...new Set(entries.map(entry=>entry.group))];
  return groups.map(group=>`<optgroup label="${esc(group)}">${
    entries.filter(entry=>entry.group===group).map(entry=>
      `<option value="${esc(entry.id)}" ${entry.id===selectedMetric?"selected":""}>${esc(entry.label)}</option>`
    ).join("")
  }</optgroup>`).join("");
}
function catalogGroups(){
  return [...new Set(kpiCatalog().map(entry=>entry.group))];
}
function defaultKpiLayout(){
  if(!DATA.weekly.length)return [];
  const latest=DATA.weekly[DATA.weekly.length-1]["KW Nr."];
  const defs=[
    ["Umsatzmenge gesamt (m³)",20,20,330,235],
    ["DB Netto (€)",375,20,330,235],
    ["Produktion KW gesamt (fm)",730,20,330,235],
    ["Auftragseingang gesamt (m³)",20,280,330,235],
    ["Auftragsbestand 4W (m³)",375,280,330,235],
    ["Verladungen gesamt",730,280,330,235]
  ];
  return defs.map((d,i)=>({id:"kpi-"+Date.now()+"-"+i,metric:d[0],week:latest,x:d[1],y:d[2],w:d[3],h:d[4],z:i+1}));
}
function loadKpiLayout(){
  try{
    const saved=JSON.parse(storageGet(KPI_LAYOUT_KEY)||"null");
    customKpis=Array.isArray(saved)?saved:defaultKpiLayout();
  }catch(e){customKpis=defaultKpiLayout()}
  topZ=Math.max(10,...customKpis.map(x=>x.z||1));
}
function saveKpiLayout(){
  storageSet(KPI_LAYOUT_KEY,JSON.stringify(customKpis));
  layoutStatus.textContent="Gespeichert · "+new Date().toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  clearTimeout(window.__layoutStatusTimer);
  window.__layoutStatusTimer=setTimeout(()=>layoutStatus.textContent="Verschieben: am blauen Kopf ziehen · Größe: unten rechts ziehen",1800);
}
function refreshBuilderWeekOptions(preferredWeek=null){
  if(!document.getElementById("builderWeek"))return;
  const definition=resolveKpiDefinition(builderMetric.value);
  const weeks=availableWeeksForKpiDefinition(definition);
  const preferred=Number(preferredWeek??builderWeek.value);
  builderWeek.innerHTML=weeks.map(week=>`<option value="${week}">KW${String(week).padStart(2,"0")}</option>`).join("");
  builderWeek.value=String(resolveKpiWeek(definition,preferred||Math.max(...weeks)));
}
function refreshBuilderMetricOptions(preferredMetric=null){
  if(!document.getElementById("builderMetric"))return;
  const group=builderGroup.value||catalogGroups()[0];
  const entries=kpiCatalog().filter(entry=>entry.group===group);
  const preferred=preferredMetric||builderMetric.value;
  builderMetric.innerHTML=entries.map(entry=>`<option value="${esc(entry.id)}">${esc(entry.label)}</option>`).join("");
  if(entries.some(entry=>entry.id===preferred))builderMetric.value=preferred;
  refreshBuilderWeekOptions();
}
function addCatalogEntriesToBoard(entries,week){
  const start=customKpis.length;
  entries.forEach((entry,index)=>{
    const absolute=start+index;
    customKpis.push({
      id:`kpi-${Date.now()}-${index}`,
      metric:entry.id,week:resolveKpiWeek(entry,week),
      x:25+(absolute%3)*350,
      y:25+Math.floor(absolute/3)*255,
      w:330,h:entry.mode==="sawline-card"?250:235,z:++topZ
    });
  });
  saveKpiLayout();renderKpiWorkspace();
}
function initKpiBuilder(weeks){
  const groups=catalogGroups();
  builderGroup.innerHTML=groups.map(group=>`<option value="${esc(group)}">${esc(group)}</option>`).join("");
  builderGroup.value=groups[0]||"";
  refreshBuilderMetricOptions();
  builderGroup.addEventListener("change",()=>refreshBuilderMetricOptions());
  builderMetric.addEventListener("change",()=>refreshBuilderWeekOptions());
  refreshBuilderWeekOptions(Math.max(...availableAllKpiWeeks()));
  loadKpiLayout();

  addKpiBtn.addEventListener("click",()=>{
    const def=resolveKpiDefinition(builderMetric.value);
    if(!def)return;
    addCatalogEntriesToBoard([def],builderWeek.value);
  });
  addGroupBtn.addEventListener("click",()=>{
    const entries=kpiCatalog().filter(entry=>entry.group===builderGroup.value);
    if(!entries.length)return;
    if(entries.length>24&&!confirm(`${entries.length} Fenster aus „${builderGroup.value}“ hinzufügen?`))return;
    addCatalogEntriesToBoard(entries,builderWeek.value);
    autoArrangeKpis();
  });
  autoLayoutBtn.addEventListener("click",autoArrangeKpis);
  defaultLayoutBtn.addEventListener("click",()=>{
    customKpis=defaultKpiLayout();saveKpiLayout();renderKpiWorkspace()
  });
  clearLayoutBtn.addEventListener("click",()=>{
    if(confirm("Alle KPI-Fenster aus der eigenen KPI-Wand entfernen?")){
      customKpis=[];saveKpiLayout();renderKpiWorkspace()
    }
  });
  renderKpiWorkspace();
}
function sparklineMarkup(values,color="#76b737"){
  const valid=values.filter(v=>v!==null&&Number.isFinite(v));
  if(!valid.length)return "";
  const W=260,H=52,p=4,min=Math.min(...valid),max=Math.max(...valid),span=max-min||1;
  const pts=values.map((v,i)=>v===null?null:[p+i*(W-2*p)/(values.length-1||1),p+(max-v)*(H-2*p)/span]);
  let d="",open=false;
  pts.forEach(pt=>{if(!pt){open=false;return}d+=(open?" L":" M")+pt[0].toFixed(1)+" "+pt[1].toFixed(1);open=true});
  return `<svg class="sparkline" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    <line x1="0" y1="${H-1}" x2="${W}" y2="${H-1}" stroke="#dbe4ee"/>
    <path d="${d}" fill="none" stroke="${color}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}
function customNumericContent(def,item){
  const series=def.series().filter(point=>Number.isFinite(point.week));
  const point=series.find(entry=>entry.week===Number(item.week));
  const index=series.findIndex(entry=>entry.week===Number(item.week));
  const previous=index>0?series[index-1]:null;
  const value=point?.value??null,previousValue=previous?.value??null;
  const delta=previous?pctDelta(previousValue,value):null;
  const values=series.map(entry=>entry.value).filter(value=>value!==null);
  const avg=values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
  const min=values.length?Math.min(...values):null,max=values.length?Math.max(...values):null;
  return `<div class="window-value">${format(value,def.type)}</div>
    <div class="window-comparison">
      <span class="delta ${deltaClass(delta)}">${delta===null?"Keine Vorwoche":`${trendArrow(delta)} ${format(delta,"percent")} zur Vorwoche`}</span>
      <span class="small">KW${item.week}</span>
    </div>
    <div class="window-stats">
      <div class="window-stat"><small>Minimum</small><strong>${format(min,def.type)}</strong></div>
      <div class="window-stat"><small>Ø Zeitraum</small><strong>${format(avg,def.type)}</strong></div>
      <div class="window-stat"><small>Maximum</small><strong>${format(max,def.type)}</strong></div>
    </div>
    ${sparklineMarkup(series.map(entry=>entry.value))}`;
}
function customSalesCardContent(def,item){
  const category=def.id.split("::").slice(1).join("::");
  const row=DATA.salesBreakdown.find(entry=>entry["KW Nr."]===Number(item.week)&&entry.Kategorie===category);
  const series=def.series();
  const index=series.findIndex(entry=>entry.week===Number(item.week));
  const previous=index>0?series[index-1]:null;
  const delta=previous?pctDelta(previous.value,n(row?.["Menge (m³)"])):null;
  return `<div class="custom-composite-main">
      <div class="window-value">${format(row?.["Menge (m³)"],"m3")}</div>
      <div class="custom-composite-unit">KW${item.week}</div>
    </div>
    <div class="window-comparison"><span class="delta ${deltaClass(delta)}">${
      delta===null?"Keine Vorwoche":`${trendArrow(delta)} ${format(delta,"percent")} Menge`
    }</span></div>
    <div class="custom-secondary-grid">
      <div class="custom-secondary"><small>Ø Preis</small><strong>${format(row?.["EUR (€/m³)"],"price")}</strong></div>
      <div class="custom-secondary"><small>Mengenanteil</small><strong>${format(row?.["M%"],"pctpoint")}</strong></div>
    </div>
    ${sparklineMarkup(series.map(entry=>entry.value))}`;
}
function customProductionCardContent(def,item){
  const point=def.series().find(entry=>entry.week===Number(item.week));
  return customNumericContent(def,item).replace(
    '<div class="window-value">',
    `<div class="custom-composite-unit">Aktuell · KW${item.week}</div><div class="window-value">`
  );
}
function customSawlineCardContent(def,item){
  const metric=def.id.split("::").slice(1).join("::");
  const row=DATA.sawlineReports.find(entry=>entry["KW Nr."]===Number(item.week)&&entry.KPI===metric);
  if(!row)return `<div class="metric-missing">Für KW${item.week} liegen für dieses Sägelinienfenster keine Daten vor.</div>`;
  const days=[["Mo","Montag"],["Di","Dienstag"],["Mi","Mittwoch"],["Do","Donnerstag"],["Fr","Freitag"],["Sa","Samstag"]];
  return `<div class="custom-composite-main">
      <div class="window-value">${format(row.Summe,row.Werttyp)}</div>
      <div class="custom-composite-unit">Summe · KW${item.week}</div>
    </div>
    <div class="custom-day-grid">${days.map(([short,key])=>`<div class="custom-day">
      <small>${short}</small><strong title="${format(row[key],row.Werttyp)}">${format(row[key],row.Werttyp)}</strong>
    </div>`).join("")}</div>
    ${sparklineMarkup(def.series().map(entry=>entry.value))}`;
}
function customQualityCardContent(def){
  const row=def.staticRow||{};
  const priority=String(row.Status||row.Bewertung||"").toLowerCase();
  const cls=priority.includes("krit")||priority.includes("fehler")?"high":
    priority.includes("hinweis")||priority.includes("prüf")?"warn":"";
  return `<span class="custom-quality-status ${cls}">${esc(row.Status||row.Bewertung||"Status")}</span>
    <div class="custom-secondary-grid">
      <div class="custom-secondary"><small>Befunde</small><strong>${esc(row.Befunde??"–")}</strong></div>
      <div class="custom-secondary"><small>Zeitraum</small><strong>${esc(row.Zeitraum||"–")}</strong></div>
    </div>
    <div class="custom-quality-text">${esc(row["Wichtigster Hinweis"]||row.Prüfergebnis||"Keine Zusatzinformation.")}</div>`;
}
function customKpiContent(item){
  const def=resolveKpiDefinition(item.metric);
  if(!def)return `<div class="metric-missing">Dieses gespeicherte KPI-Fenster ist in den aktuellen Daten nicht mehr vorhanden.</div>`;
  if(def.mode==="sales-card")return customSalesCardContent(def,item);
  if(def.mode==="production-card")return customProductionCardContent(def,item);
  if(def.mode==="sawline-card")return customSawlineCardContent(def,item);
  if(def.mode==="quality-card")return customQualityCardContent(def);
  return customNumericContent(def,item);
}
function renderKpiWorkspace(){
  if(!document.getElementById("kpiWorkspace"))return;
  if(!customKpis.length){
    kpiWorkspace.innerHTML='<div class="workspace-empty">Über „Fenster hinzufügen“ einzelne KPIs auswählen oder eine vollständige Datenbereichsgruppe übernehmen.</div>';
    kpiWorkspace.style.height="720px";return
  }
  kpiWorkspace.innerHTML=customKpis.map(item=>{
    const def=resolveKpiDefinition(item.metric);
    const title=def?.label||item.metric;
    const weekOptions=availableWeeksForKpiDefinition(def);
    item.week=resolveKpiWeek(def,item.week);
    return `<article class="custom-kpi-window" data-id="${esc(item.id)}"
      style="left:${item.x}px;top:${item.y}px;width:${item.w}px;height:${item.h}px;z-index:${item.z||1}">
    <header class="window-head" data-drag-handle>
      <span aria-hidden="true">⠿</span><span class="window-title" title="${esc(title)}">${esc(title)}</span>
      <button class="window-action" data-duplicate title="Duplizieren">⧉</button>
      <button class="window-action" data-remove title="Entfernen">×</button>
    </header>
    <div class="window-controls">
      <select data-role="metric" aria-label="KPI oder Anzeigefenster auswählen">${metricOptionMarkup(item.metric)}</select>
      <select data-role="week" aria-label="Kalenderwoche auswählen">${weekOptions.map(w=>`<option value="${w}" ${Number(item.week)===w?"selected":""}>KW${String(w).padStart(2,"0")}</option>`).join("")}</select>
    </div>
    <div class="window-body">${customKpiContent(item)}</div>
    <div class="resize-handle" data-resize-handle title="Fenstergröße ändern"></div>
  </article>`}).join("");
  const maxBottom=Math.max(700,...customKpis.map(x=>x.y+x.h+30));
  kpiWorkspace.style.height=maxBottom+"px";
  kpiWorkspace.querySelectorAll(".custom-kpi-window").forEach(bindKpiWindow);
}
function findKpi(id){return customKpis.find(x=>x.id===id)}
function focusKpi(el,item){
  topZ++;item.z=topZ;el.style.zIndex=topZ;
  kpiWorkspace.querySelectorAll(".custom-kpi-window").forEach(x=>x.classList.remove("focused"));el.classList.add("focused")
}
function bindKpiWindow(el){
  const id=el.dataset.id,item=findKpi(id);
  el.addEventListener("pointerdown",()=>focusKpi(el,item));
  el.querySelector("[data-remove]").addEventListener("click",e=>{
    e.stopPropagation();customKpis=customKpis.filter(x=>x.id!==id);saveKpiLayout();renderKpiWorkspace()
  });
  el.querySelector("[data-duplicate]").addEventListener("click",e=>{
    e.stopPropagation();customKpis.push({...item,id:"kpi-"+Date.now(),x:item.x+30,y:item.y+30,z:++topZ});saveKpiLayout();renderKpiWorkspace()
  });
  el.querySelector('[data-role="metric"]').addEventListener("change",e=>{
    item.metric=e.target.value;
    item.week=resolveKpiWeek(resolveKpiDefinition(item.metric),item.week);
    saveKpiLayout();renderKpiWorkspace()
  });
  el.querySelector('[data-role="week"]').addEventListener("change",e=>{
    item.week=Number(e.target.value);saveKpiLayout();renderKpiWorkspace()
  });
  const head=el.querySelector("[data-drag-handle]");
  head.addEventListener("pointerdown",e=>{
    if(e.target.closest("button"))return;
    e.preventDefault();head.setPointerCapture(e.pointerId);focusKpi(el,item);
    const startX=e.clientX,startY=e.clientY,ox=item.x,oy=item.y;
    const move=ev=>{
      item.x=Math.max(0,Math.round((ox+ev.clientX-startX)/5)*5);
      item.y=Math.max(0,Math.round((oy+ev.clientY-startY)/5)*5);
      el.style.left=item.x+"px";el.style.top=item.y+"px";
      kpiWorkspace.style.height=Math.max(720,item.y+item.h+30)+"px";
    };
    const up=()=>{head.removeEventListener("pointermove",move);head.removeEventListener("pointerup",up);saveKpiLayout()};
    head.addEventListener("pointermove",move);head.addEventListener("pointerup",up,{once:true})
  });
  const resize=el.querySelector("[data-resize-handle]");
  resize.addEventListener("pointerdown",e=>{
    e.preventDefault();e.stopPropagation();resize.setPointerCapture(e.pointerId);focusKpi(el,item);
    const startX=e.clientX,startY=e.clientY,ow=item.w,oh=item.h;
    const move=ev=>{
      item.w=Math.max(245,Math.round((ow+ev.clientX-startX)/5)*5);
      item.h=Math.max(190,Math.round((oh+ev.clientY-startY)/5)*5);
      el.style.width=item.w+"px";el.style.height=item.h+"px";
      kpiWorkspace.style.height=Math.max(720,item.y+item.h+30)+"px";
    };
    const up=()=>{resize.removeEventListener("pointermove",move);resize.removeEventListener("pointerup",up);saveKpiLayout()};
    resize.addEventListener("pointermove",move);resize.addEventListener("pointerup",up,{once:true})
  });
}
function autoArrangeKpis(){
  const shell=kpiWorkspace.parentElement;
  const available=Math.max(1050,shell.clientWidth-20),tileW=330,tileH=235,gap=20;
  const cols=Math.max(1,Math.floor((available-gap)/(tileW+gap)));
  customKpis.forEach((item,i)=>{
    item.x=gap+(i%cols)*(tileW+gap);item.y=gap+Math.floor(i/cols)*(tileH+gap);
    item.w=tileW;item.h=tileH;item.z=i+1
  });
  topZ=customKpis.length+1;saveKpiLayout();renderKpiWorkspace()
}

function downloadCSV(){
  const rows=selectedWeekly();if(!rows.length)return;
  const headers=Object.keys(rows[0]).filter(k=>k!=="Quelldatei");
  const csv=[headers, ...rows.map(r=>headers.map(h=>r[h]))].map(row=>row.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(";")).join("\n");
  const blob=new Blob(["﻿"+csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=`KW_Daten_${rows[0].KW}-${rows[rows.length-1].KW}.csv`;a.click();URL.revokeObjectURL(url)
}

/* PDF-Export: aktive Ansicht über den Druckdialog als PDF sichern (offline, ohne externe Bibliothek). */
const QUESTION_PANEL_KEY="kwDashboardQuestionPanelHidden";
function setQuestionPanelHidden(hidden){
  const panel=document.getElementById("dashboardQuestionPanel");
  const btn=document.getElementById("toggleQuestionBtn");
  if(panel)panel.hidden=!!hidden;
  if(btn){
    btn.textContent=hidden?"Frage einblenden":"Frage ausblenden";
    btn.setAttribute("aria-pressed",hidden?"false":"true");
  }
  storageSet(QUESTION_PANEL_KEY,hidden?"1":"0");
}
function initQuestionToggle(){
  const btn=document.getElementById("toggleQuestionBtn");
  if(!btn)return;
  setQuestionPanelHidden(storageGet(QUESTION_PANEL_KEY)==="1");
  btn.addEventListener("click",()=>{
    const panel=document.getElementById("dashboardQuestionPanel");
    setQuestionPanelHidden(!(panel&&panel.hidden));
  });
}
function exportDashboardPdf(){
  const activeView=document.querySelector(".view.active");
  const activeTab=nav.querySelector("button.active[data-view]");
  const viewName=activeTab?activeTab.textContent.trim():(activeView?activeView.id:"Dashboard");
  const kw=document.getElementById("displayWeek")?`KW${displayWeek.value}`:"";
  const year=activeDashboardYear();
  const now=new Date();
  const dateStr=now.toLocaleDateString("de-DE",{day:"2-digit",month:"2-digit",year:"numeric"});
  const printHeader=document.getElementById("printHeader");
  if(printHeader){
    printHeader.innerHTML=`<div class="ph-title">Sägewerk Streit · ${esc(viewName)}</div>
      <div class="ph-meta">Stand ${esc(kw)}/${esc(String(year))} · erzeugt am ${esc(dateStr)} · Wochen- & YTD-Dashboard</div>`;
  }
  const previousTitle=document.title;
  document.title=`Streit_Dashboard_${viewName.replace(/[^\wäöüÄÖÜß-]+/g,"_")}_${kw}_${year}`;
  const restore=()=>{document.title=previousTitle;window.removeEventListener("afterprint",restore);};
  window.addEventListener("afterprint",restore);
  if(typeof setUploadStatus==="function")setUploadStatus("PDF-Export: Es öffnet sich der Druckdialog – dort als Ziel »Als PDF speichern« wählen. Erscheint kein Dialog (eingebettete Ansicht), die Seite in einem eigenen Browser-Tab öffnen und Strg/Cmd+P nutzen.","working");
  // Charts sind bereits gerendert; kurz warten, damit Layout-Reflow greift, dann drucken.
  setTimeout(()=>{ try{window.print();}catch(e){ if(typeof setUploadStatus==="function")setUploadStatus("Druckdialog in dieser Ansicht nicht verfügbar. Bitte die Seite in einem eigenen Browser-Tab öffnen und Strg/Cmd+P → »Als PDF speichern« verwenden.","error"); } },60);
}

const CLOSED_STANDARD_WINDOWS_KEY="kwDashboardClosedStandardWindowsV1";
let closedStandardWindows=new Set();

function loadClosedStandardWindows(){
  try{
    const saved=JSON.parse(storageGet(CLOSED_STANDARD_WINDOWS_KEY)||"[]");
    closedStandardWindows=new Set(Array.isArray(saved)?saved:[]);
  }catch(error){
    closedStandardWindows=new Set();
  }
}
function saveClosedStandardWindows(){
  storageSet(CLOSED_STANDARD_WINDOWS_KEY,JSON.stringify([...closedStandardWindows]));
}
function normalizeWindowKeyText(value){
  return String(value||"fenster")
    .trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g,"")
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/^-+|-+$/g,"")||"fenster";
}
function standardWindowTitle(element){
  const target=
    element.querySelector(":scope > .kpi-head .kpi-label")||
    element.querySelector(":scope > .detail-kpi-label")||
    element.querySelector(":scope > .sawline-kpi-title")||
    element.querySelector(":scope > .quality-title")||
    element.querySelector(":scope > .card-title-row h3")||
    element.querySelector(":scope > h3")||
    element.querySelector("h3");
  return target?.textContent?.trim()||element.className;
}
function standardWindowKey(element){
  if(element.dataset.standardWindowKey)return element.dataset.standardWindowKey;
  const view=element.closest(".view");
  const viewId=view?.id||"dashboard";
  const title=normalizeWindowKeyText(standardWindowTitle(element));
  const candidates=[...view.querySelectorAll(
    ":scope .card, :scope .kpi, :scope .detail-kpi, :scope .sawline-kpi-card, :scope .quality-card"
  )].filter(item=>!item.closest("#builder"));
  const sameTitle=candidates.filter(item=>normalizeWindowKeyText(standardWindowTitle(item))===title);
  const duplicateIndex=Math.max(0,sameTitle.indexOf(element));
  const key=`${viewId}:${title}:${duplicateIndex}`;
  element.dataset.standardWindowKey=key;
  return key;
}
function updateViewEmptyState(view){
  if(!view||view.id==="builder")return;
  const windows=[...view.querySelectorAll(
    ":scope .card, :scope .kpi, :scope .detail-kpi, :scope .sawline-kpi-card, :scope .quality-card"
  )].filter(item=>!item.closest("#builder"));
  let empty=view.querySelector(":scope > .view-empty-state");
  if(!empty){
    empty=document.createElement("div");
    empty.className="view-empty-state";
    empty.innerHTML="<strong>Alle Anzeigefenster dieses Reiters sind geschlossen.</strong>Über „Fenster zurücksetzen“ im Header werden alle Standardfenster wieder eingeblendet.";
    view.appendChild(empty);
  }
  empty.classList.toggle("visible",windows.length>0&&windows.every(item=>item.classList.contains("standard-window-hidden")));
}
function closeStandardWindow(element){
  const key=standardWindowKey(element);
  closedStandardWindows.add(key);
  saveClosedStandardWindows();
  element.classList.add("standard-window-hidden");
  updateViewEmptyState(element.closest(".view"));
}
function applyClosableStandardWindows(){
  document.querySelectorAll(
    ".view:not(#builder) .card, .view:not(#builder) .kpi, .view:not(#builder) .detail-kpi, .view:not(#builder) .sawline-kpi-card, .view:not(#builder) .quality-card"
  ).forEach(element=>{
    const key=standardWindowKey(element);
    element.classList.toggle("standard-window-hidden",closedStandardWindows.has(key));
    if(!element.querySelector(":scope > .standard-window-close")){
      const button=document.createElement("button");
      button.type="button";
      button.className="standard-window-close";
      button.setAttribute("aria-label",`${standardWindowTitle(element)} schließen`);
      button.title="Anzeigefenster schließen";
      button.textContent="×";
      button.addEventListener("click",event=>{
        event.preventDefault();event.stopPropagation();closeStandardWindow(element);
      });
      element.appendChild(button);
    }
  });
  document.querySelectorAll(".view:not(#builder)").forEach(updateViewEmptyState);
}
function resetStandardWindows(){
  closedStandardWindows.clear();
  storageRemove(CLOSED_STANDARD_WINDOWS_KEY);
  document.querySelectorAll(".standard-window-hidden").forEach(element=>element.classList.remove("standard-window-hidden"));
  document.querySelectorAll(".view-empty-state").forEach(element=>element.classList.remove("visible"));
  applyClosableStandardWindows();
  setUploadStatus("Alle Standardfenster wurden wieder eingeblendet. Die eigene KPI-Wand bleibt unverändert.","success");
}

const WORLD_COUNTRIES={
  "FRANKREICH":{code:"FR",lon:2.4,lat:46.8},
  "DEUTSCHLAND":{code:"DE",lon:10.2,lat:51.1},
  "GROSSBRITANNIEN":{code:"GB",lon:-1.9,lat:52.9},
  "IRLAND":{code:"IE",lon:-8.0,lat:53.3},
  "NIEDERLANDE":{code:"NL",lon:5.6,lat:52.2},
  "BELGIEN":{code:"BE",lon:4.6,lat:50.6},
  "ITALIEN":{code:"IT",lon:12.6,lat:42.9},
  "SPANIEN":{code:"ES",lon:-3.7,lat:40.3},
  "PORTUGAL":{code:"PT",lon:-8.2,lat:39.7},
  "ÖSTERREICH":{code:"AT",lon:14.4,lat:47.6},
  "SCHWEIZ":{code:"CH",lon:8.2,lat:46.9}
};
let worldMapMode="week";
const worldMapTipByLand={};
function worldMapMetricConfig(metric){
  const configs={
    revenue:{label:"Umsatz",type:"currency"},
    volume:{label:"Menge",type:"m3"},
    price:{label:"Ø-Preis",type:"price"},
    share:{label:"Mengenanteil",type:"pctpoint"}
  };
  return configs[metric]||configs.revenue;
}
function worldMapMetricValue(row,metric){
  if(metric==="revenue")return row.rev;
  if(metric==="volume")return row.vol;
  if(metric==="price")return row.price;
  return row.share;
}
function worldMapShort(value,metric){
  if(value===null||value===undefined||!Number.isFinite(value))return "–";
  if(metric==="revenue")return value>=1000?fmt0.format(value/1000)+" k€":fmt0.format(value)+" €";
  if(metric==="volume")return fmt0.format(value)+" m³";
  if(metric==="price")return fmt0.format(value)+" €";
  return fmtNum.format(value)+" %";
}
function worldMapCountryData(){
  const names=Object.keys(WORLD_COUNTRIES);
  if(worldMapMode==="week"){
    const week=Number(worldMapWeek.value)||Math.max(...availableDashboardWeeks());
    const weekly=DATA.weekly.find(r=>r["KW Nr."]===week);
    const total=n(weekly?.["Umsatzmenge gesamt (m³)"]);
    const wprice=n(weekly?.["Ø Preis gesamt (€/m³)"]);
    const rows=names.map(name=>{
      const row=(DATA.countryComparison||[]).find(r=>r["KW Nr."]===week&&r.Land===name);
      const mp=n(row?.["M%"]);
      const vol=(total!==null&&mp!==null)?total*mp/100:null;
      const price=n(row?.["Ø-Preis Gesamt"])??wprice??null;
      const rev=(vol!==null&&price!==null)?vol*price:null;
      return {land:name,...WORLD_COUNTRIES[name],vol,rev,price,share:mp};
    });
    return {rows,label:`KW${String(week).padStart(2,"0")}`};
  }
  const weeks=availableDashboardWeeks();
  const rows=names.map(name=>{
    let volSum=0,revSum=0,count=0;
    weeks.forEach(week=>{
      const weekly=DATA.weekly.find(r=>r["KW Nr."]===week);
      const total=n(weekly?.["Umsatzmenge gesamt (m³)"]);
      const wprice=n(weekly?.["Ø Preis gesamt (€/m³)"]);
      const row=(DATA.countryComparison||[]).find(r=>r["KW Nr."]===week&&r.Land===name);
      const mp=n(row?.["M%"]);
      if(total===null||mp===null)return;
      const vol=total*mp/100;
      const price=n(row?.["Ø-Preis Gesamt"])??wprice??null;
      volSum+=vol;count++;
      if(price!==null)revSum+=vol*price;
    });
    return {land:name,...WORLD_COUNTRIES[name],vol:count?volSum:null,rev:count?revSum:null,price:volSum?revSum/volSum:null,share:null,count};
  });
  const totalVol=rows.reduce((sum,r)=>sum+(r.vol||0),0);
  rows.forEach(r=>r.share=totalVol?(r.vol||0)/totalVol*100:null);
  return {rows,label:`Jahressumme · ${weeks.length} KW`};
}
function worldMapProject(lon,lat){
  const VB_W=760,VB_H=560,PAD=26,lonMin=-11,lonMax=19,latMin=35,latMax=59;
  return {
    x:PAD+(lon-lonMin)/(lonMax-lonMin)*(VB_W-2*PAD),
    y:PAD+(latMax-lat)/(latMax-latMin)*(VB_H-2*PAD),
    sx:(VB_W-2*PAD)/(lonMax-lonMin),
    sy:(VB_H-2*PAD)/(latMax-latMin)
  };
}
function worldMapColor(ratio){
  return `hsl(96 ${42+ratio*26}% ${74-ratio*38}%)`;
}
/* YTD-Kennzahlen je Land über einen fest vorgegebenen Wochensatz (like-for-like je Jahr). */
function worldMapYtdStats(land,year,weekSet){
  const dy=historyDashboardYear();
  const wk=(DATA.weeklyHistory&&DATA.weeklyHistory.length)?DATA.weeklyHistory:(DATA.weekly||[]);
  let vol=0,rev=0,has=false;
  wk.forEach(w=>{
    if(historyRowYear(w,dy)!==year)return;
    const kw=w["KW Nr."];if(!Number.isFinite(kw)||!weekSet.has(kw))return;
    const total=n(w["Umsatzmenge gesamt (m³)"]);if(total===null)return;
    const wprice=n(w["Ø Preis gesamt (€/m³)"]);
    const cr=(DATA.countryHistory||DATA.countryComparison||[]).find(r=>Number(r.Jahr||dy)===year&&r["KW Nr."]===kw&&r.Land===land);
    const mp=n(cr?.["M%"]);if(mp===null)return;
    const v=total*mp/100;
    const price=n(cr?.["Ø-Preis Gesamt"])??wprice??null;
    vol+=v;if(price!==null)rev+=v*price;has=true;
  });
  return has?{vol,rev,price:vol?rev/vol:null}:{vol:null,rev:null,price:null};
}
function worldMapYoyData(){
  const dy=historyDashboardYear();
  const years=[...new Set((DATA.countryHistory||DATA.countryComparison||[]).map(r=>Number(r.Jahr||dy)))].filter(Number.isFinite).sort((a,b)=>a-b);
  const active=(typeof activeDashboardYear==="function")?activeDashboardYear():dy;
  const currentYear=years.includes(active)?active:(years.length?years[years.length-1]:dy),prevYear=currentYear-1;
  const wk=(DATA.weeklyHistory&&DATA.weeklyHistory.length)?DATA.weeklyHistory:(DATA.weekly||[]);
  const weeksOf=yr=>new Set(wk.filter(w=>historyRowYear(w,dy)===yr).map(w=>w["KW Nr."]).filter(Number.isFinite));
  const curWeeksSet=weeksOf(currentYear),prevWeeksSet=weeksOf(prevYear);
  const cutoff=curWeeksSet.size?Math.max(...curWeeksSet):0;
  // Fairer YTD-Vergleich: nur Wochen, die in BEIDEN Jahren vorliegen (bis zur Stichwoche des laufenden Jahres).
  const commonWeeks=[...curWeeksSet].filter(w=>w<=cutoff&&prevWeeksSet.has(w)).sort((a,b)=>a-b);
  const commonSet=new Set(commonWeeks);
  const available=years.includes(prevYear)&&commonWeeks.length>0;
  const compareFrom=commonWeeks.length?commonWeeks[0]:null,compareTo=commonWeeks.length?commonWeeks[commonWeeks.length-1]:cutoff;
  const lands=Object.keys(WORLD_COUNTRIES);
  const cur={},prev={};
  lands.forEach(l=>{cur[l]=worldMapYtdStats(l,currentYear,commonSet);prev[l]=available?worldMapYtdStats(l,prevYear,commonSet):{vol:null,rev:null,price:null};});
  const curTotal=lands.reduce((s,l)=>s+(cur[l].vol||0),0);
  const prevTotal=lands.reduce((s,l)=>s+(prev[l].vol||0),0);
  const map={};
  lands.forEach(l=>{
    const c=cur[l],pv=prev[l];
    const delta=(c.vol!==null&&pv.vol!==null&&pv.vol!==0)?(c.vol-pv.vol)/pv.vol*100:null;
    map[l]={
      cur:{...c,share:curTotal?(c.vol||0)/curTotal*100:null},
      prev:{...pv,share:prevTotal?(pv.vol||0)/prevTotal*100:null},
      delta
    };
  });
  return {map,currentYear,prevYear,cutoff,available,compareFrom,compareTo,weekCount:commonWeeks.length};
}
function worldMapYoyGauge(entry,currentYear,prevYear){
  const cur=entry.cur.vol,prev=entry.prev.vol,delta=entry.delta;
  const ratio=(prev&&prev!==0&&cur!==null)?cur/prev:null;
  const fillPct=ratio===null?0:Math.max(0,Math.min(2,ratio))/2*100;   // Skala 0–200 %, Mitte = Vorjahresniveau
  const up=delta!==null&&delta>=0;
  const color=delta===null?"#9fb0c0":(up?"#57c473":"#e06d6d");
  const valText=delta===null?"–":`${up?"+":""}${fmt2.format(delta)} %`;
  return `<div class="wm-yoy">
    <div class="wm-yoy-head">Δ YTD-Menge ${currentYear} zu ${prevYear}</div>
    <div class="wm-gauge">
      <div class="wm-gauge-track"><div class="wm-gauge-fill" style="width:${fmt2.format(fillPct)}%;background:${color}"></div><div class="wm-gauge-base" title="Vorjahresniveau"></div></div>
      <div class="wm-gauge-val" style="color:${color}">${valText}</div>
    </div>
  </div>`;
}
function worldMapYoyTooltip(land,entry,yoy){
  const {currentYear,prevYear,compareFrom,compareTo,weekCount}=yoy;
  const c=entry.cur,pv=entry.prev;
  const rangeTxt=(compareFrom!=null)
    ?`KW${String(compareFrom).padStart(2,"0")}–KW${String(compareTo).padStart(2,"0")} · ${weekCount} Woche${weekCount===1?"":"n"}`
    :`bis KW${String(compareTo).padStart(2,"0")}`;
  const rows=[
    ["Menge",format(c.vol,"m3"),format(pv.vol,"m3")],
    ["Umsatz",format(c.rev,"currency"),format(pv.rev,"currency")],
    ["Ø-Preis",format(c.price,"price"),format(pv.price,"price")],
    ["Mengenanteil",format(c.share,"pctpoint"),format(pv.share,"pctpoint")]
  ];
  const table=`<table class="wm-cmp"><thead><tr><th></th><th>${currentYear}</th><th>${prevYear}</th></tr></thead><tbody>`+
    rows.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join("")+`</tbody></table>`;
  return `<b>${esc(land)}</b> · YTD ${esc(rangeTxt)} (gleicher Zeitraum je Jahr)${table}`+worldMapYoyGauge(entry,currentYear,prevYear);
}
function renderWorldMap(){
  if(!document.getElementById("worldMapSvg"))return;
  const metric=worldMapMetric.value,cfg=worldMapMetricConfig(metric);
  worldMapChip.textContent=cfg.label;
  worldMapWeek.disabled=worldMapMode!=="week";
  document.querySelectorAll('#worldMapMode button').forEach(btn=>btn.classList.toggle("active",btn.dataset.mode===worldMapMode));

  const {rows,label}=worldMapCountryData();
  const valueOf=row=>worldMapMetricValue(row,metric);
  const totalRev=rows.reduce((sum,r)=>sum+(r.rev||0),0);
  const totalVol=rows.reduce((sum,r)=>sum+(r.vol||0),0);
  const active=rows.filter(r=>(r.vol||0)>0).length;
  const ranked=[...rows].filter(r=>valueOf(r)!==null&&valueOf(r)>0).sort((a,b)=>valueOf(b)-valueOf(a));
  const top=ranked[0]||null;
  const avgPrice=totalVol?totalRev/totalVol:null;

  worldMapKpis.innerHTML=[
    detailKpi("Gesamtumsatz",totalRev,"currency",label),
    detailKpi(`Stärkster Markt · ${cfg.label}`,top?valueOf(top):null,cfg.type,top?`${top.land} · ${label}`:"–"),
    detailKpi("Aktive Märkte",active,"number",`von ${rows.length} · ${label}`),
    detailKpi("Ø-Preis (gewichtet)",avgPrice,"price",label)
  ].join("");

  const positives=ranked.map(valueOf);
  const maxVal=Math.max(...positives,1);
  const minVal=positives.length?Math.min(...positives):0;
  const colorFor=value=>{
    if(value===null||value===undefined||!Number.isFinite(value)||value<=0)return "#dbe1d4";
    const ratio=maxVal===minVal?1:(value-minVal)/(maxVal-minVal);
    return worldMapColor(Math.max(.08,Math.min(1,ratio)));
  };
  const compare=!!(document.getElementById("worldMapCompare")&&worldMapCompare.checked);
  const yoy=compare?worldMapYoyData():null;
  Object.keys(worldMapTipByLand).forEach(key=>delete worldMapTipByLand[key]);
  rows.forEach(row=>{
    let tip;
    if(compare&&yoy&&yoy.available){
      tip=worldMapYoyTooltip(row.land,yoy.map[row.land],yoy);
    }else{
      tip=`<b>${esc(row.land)}</b> · ${esc(label)}<br>`+
        `Umsatz: ${format(row.rev,"currency")}<br>`+
        `Menge: ${format(row.vol,"m3")}<br>`+
        `Ø-Preis: ${format(row.price,"price")}<br>`+
        `Mengenanteil: ${format(row.share,"pctpoint")}`;
      if(compare)tip+=`<div class="wm-yoy"><div class="wm-yoy-head">Vorjahresvergleich</div><div class="wm-yoy-abs">Keine Vorjahresdaten geladen${yoy?` (${yoy.prevYear})`:""}.</div></div>`;
    }
    worldMapTipByLand[row.land]=tip;
  });
  const rowByLand=Object.fromEntries(rows.map(row=>[row.land,row]));
  const contextSvg=(typeof GEO_CONTEXT!=="undefined"?GEO_CONTEXT:[]).map(d=>`<path class="worldmap-context" d="${d}"/>`).join("");
  const markets=typeof GEO_MARKETS!=="undefined"?GEO_MARKETS:{};
  const countrySvg=Object.entries(markets).map(([name,geo])=>{
    const row=rowByLand[name],value=row?valueOf(row):null;
    return `<path class="worldmap-country" data-land="${esc(name)}" d="${geo.path}" fill="${colorFor(value)}"/>`;
  }).join("");
  const labelSvg=Object.entries(markets).map(([name,geo])=>{
    const row=rowByLand[name],value=row?valueOf(row):null;
    return `<text class="worldmap-code" x="${geo.cx}" y="${geo.cy-4}">${row?row.code:geo.iso}</text>`+
      `<text class="worldmap-blabel" x="${geo.cx}" y="${geo.cy+9}">${worldMapShort(value,metric)}</text>`;
  }).join("");
  const VW=typeof GEO_VIEW!=="undefined"?GEO_VIEW.w:760,VH=typeof GEO_VIEW!=="undefined"?GEO_VIEW.h:560;
  worldMapSvg.innerHTML=`<svg viewBox="0 0 ${VW} ${VH}" role="img" aria-label="Karte der Absatzmärkte">
    <rect class="worldmap-sea" x="0" y="0" width="${VW}" height="${VH}"/>
    ${contextSvg}${countrySvg}${labelSvg}
  </svg>`;
  worldMapSvg.querySelectorAll(".worldmap-country").forEach(el=>{
    el.addEventListener("mousemove",e=>showTip(e,worldMapTipByLand[el.dataset.land]||el.dataset.land));
    el.addEventListener("mouseleave",hideTip);
  });

  worldMapLegend.innerHTML=`<div><strong style="color:var(--forest)">${cfg.label}</strong> je Land · dunkleres Grün = höherer Wert · Werte per Mauszeiger</div>
    <div class="worldmap-scale">
      <span class="worldmap-scale-min">${worldMapShort(minVal,metric)}</span>
      <span class="worldmap-scale-bar" style="background:linear-gradient(90deg,${worldMapColor(.1)},${worldMapColor(.5)},${worldMapColor(1)})"></span>
      <span class="worldmap-scale-max">${worldMapShort(maxVal,metric)}</span>
    </div>`;

  worldMapRankTitle.textContent=`Rangliste · ${cfg.label}`;
  worldMapRankSub.textContent=label;
  const rankMax=Math.max(...ranked.map(valueOf),1);
  worldMapRankList.innerHTML=ranked.length?ranked.map((row,index)=>`<div class="worldmap-rank-row">
    <span class="worldmap-rank-pos">${index+1}</span>
    <span class="worldmap-rank-name" title="${esc(row.land)}">${esc(row.land)}</span>
    <span class="worldmap-rank-bar-wrap">
      <span class="worldmap-rank-bar" style="width:${Math.max(3,valueOf(row)/rankMax*100)}%;background:${worldMapColor(Math.min(1,valueOf(row)/rankMax))}"></span>
      <span class="worldmap-rank-val">${format(valueOf(row),cfg.type)}</span>
    </span>
  </div>`).join(""):'<div class="small">Keine Werte für die gewählte Kennzahl.</div>';

  worldMapTableSub.textContent=`${label} · hergeleitete Menge und Umsatz sowie gemeldeter Ø-Preis und Mengenanteil.`;
  const tableRows=[...rows].sort((a,b)=>(b.rev||0)-(a.rev||0)).map(row=>({
    "Land":row.land,"Menge (m³)":row.vol,"Umsatz (€)":row.rev,"Ø-Preis (€/m³)":row.price,"M%":row.share
  }));
  renderTable("worldMapTable",tableRows,[
    ["Land","text"],["Menge (m³)","m3"],["Umsatz (€)","currency"],["Ø-Preis (€/m³)","price"],["M%","pctpoint"]
  ]);
}
function initWorldMap(){
  if(!document.getElementById("worldMapWeek"))return;
  const weeks=availableDashboardWeeks();
  worldMapWeek.innerHTML=weeks.map(week=>`<option value="${week}">KW${String(week).padStart(2,"0")}</option>`).join("");
  worldMapWeek.value=String(Math.max(...weeks));
  worldMapMetric.addEventListener("change",renderWorldMap);
  worldMapWeek.addEventListener("change",renderWorldMap);
  const cmp=document.getElementById("worldMapCompare");
  if(cmp)cmp.addEventListener("change",renderWorldMap);
  document.querySelectorAll('#worldMapMode button').forEach(btn=>btn.addEventListener("click",()=>{
    worldMapMode=btn.dataset.mode;renderWorldMap();
  }));
}

const COUNTRY_POINTS=[
  {id:"M%",label:"Mengenanteil",unit:"M%",type:"pctpoint",kind:"field",field:"M%"},
  {id:"vol",label:"Menge (hergeleitet)",unit:"m³",type:"m3",kind:"vol"},
  {id:"rev",label:"Umsatz (hergeleitet)",unit:"€",type:"currency",kind:"rev"},
  {id:"Ø-Preis Gesamt",label:"Ø-Preis Gesamt",unit:"€/m³",type:"price",kind:"field",field:"Ø-Preis Gesamt"},
  {id:"Ø-Preis HW-Säge",label:"Ø-Preis HW-Säge",unit:"€/m³",type:"price",kind:"field",field:"Ø-Preis HW-Säge"},
  {id:"swprice",label:"Ø-Preis SW (abgeleitet)",unit:"€/m³",type:"price",kind:"swprice"},
  {id:"M% HW-Säge",label:"Anteil HW-Säge",unit:"M%",type:"pctpoint",kind:"field",field:"M% HW-Säge"},
  {id:"M% SW",label:"Anteil Seitenware",unit:"M%",type:"pctpoint",kind:"field",field:"M% SW"}
];
const CP_STORAGE_KEY="kwDashboardCountryPointsV1";
let cpMode="week";
let cpSelected=new Set(["M%","vol","rev","Ø-Preis Gesamt"]);
let cpChartPointId="rev";
function cpSaveState(){storageSet(CP_STORAGE_KEY,JSON.stringify({mode:cpMode,points:[...cpSelected],chart:cpChartPointId}))}
function cpLoadState(){
  try{
    const s=JSON.parse(storageGet(CP_STORAGE_KEY)||"null");
    if(s){
      if(s.mode==="week"||s.mode==="sum")cpMode=s.mode;
      if(Array.isArray(s.points)&&s.points.length)cpSelected=new Set(s.points.filter(id=>COUNTRY_POINTS.some(p=>p.id===id)));
      if(s.chart&&COUNTRY_POINTS.some(p=>p.id===s.chart))cpChartPointId=s.chart;
    }
  }catch(error){}
}
function cpPointById(id){return COUNTRY_POINTS.find(p=>p.id===id)}
function cpValue(rec,point){
  if(!point)return null;
  if(point.kind==="vol")return rec.vol;
  if(point.kind==="rev")return rec.rev;
  if(point.kind==="swprice")return rec.swprice;
  return rec[point.field];
}
function countryPointsRecords(){
  const names=[...new Set((DATA.countryComparison||[]).map(r=>r.Land))];
  if(cpMode==="week"){
    const week=Number(cpWeek.value)||Math.max(...availableDashboardWeeks());
    const weekly=DATA.weekly.find(r=>r["KW Nr."]===week);
    const total=n(weekly?.["Umsatzmenge gesamt (m³)"]);
    const wprice=n(weekly?.["Ø Preis gesamt (€/m³)"]);
    const recs=names.map(name=>{
      const row=(DATA.countryComparison||[]).find(r=>r["KW Nr."]===week&&r.Land===name)||{Land:name};
      const mp=n(row["M%"]);
      const vol=(total!==null&&mp!==null)?total*mp/100:null;
      const price=n(row["Ø-Preis Gesamt"])??wprice??null;
      const rev=(vol!==null&&price!==null)?vol*price:null;
      return {land:name,"M%":mp,"Ø-Preis Gesamt":n(row["Ø-Preis Gesamt"]),"Ø-Preis HW-Säge":n(row["Ø-Preis HW-Säge"]),
        "M% HW-Säge":n(row["M% HW-Säge"]),"M% SW":n(row["M% SW"]),vol,rev,swprice:derivedSwPrice(row)};
    });
    return {recs,label:`KW${String(week).padStart(2,"0")}`};
  }
  const weeks=availableDashboardWeeks();
  const recs=names.map(name=>{
    let volSum=0,revSum=0,count=0,hwPw=0,hwPwt=0,hwShW=0,hwShWt=0,swShW=0,swShWt=0;
    weeks.forEach(week=>{
      const weekly=DATA.weekly.find(r=>r["KW Nr."]===week);
      const total=n(weekly?.["Umsatzmenge gesamt (m³)"]);
      const wprice=n(weekly?.["Ø Preis gesamt (€/m³)"]);
      const row=(DATA.countryComparison||[]).find(r=>r["KW Nr."]===week&&r.Land===name);
      const mp=n(row?.["M%"]);
      if(total===null||mp===null)return;
      const vol=total*mp/100;volSum+=vol;count++;
      const price=n(row?.["Ø-Preis Gesamt"])??wprice??null;if(price!==null)revSum+=vol*price;
      const hwp=n(row?.["Ø-Preis HW-Säge"]);if(hwp!==null){hwPw+=vol*hwp;hwPwt+=vol;}
      const hwS=n(row?.["M% HW-Säge"]);if(hwS!==null){hwShW+=vol*hwS;hwShWt+=vol;}
      const swS=n(row?.["M% SW"]);if(swS!==null){swShW+=vol*swS;swShWt+=vol;}
    });
    const price=volSum?revSum/volSum:null;
    const hwPrice=hwPwt?hwPw/hwPwt:null;
    const hwShare=hwShWt?hwShW/hwShWt:null;
    const swShare=swShWt?swShW/swShWt:null;
    return {land:name,vol:count?volSum:null,rev:count?revSum:null,"Ø-Preis Gesamt":price,"Ø-Preis HW-Säge":hwPrice,
      "M% HW-Säge":hwShare,"M% SW":swShare,swprice:derivedSwPrice({"Ø-Preis Gesamt":price,"Ø-Preis HW-Säge":hwPrice,"M% HW-Säge":hwShare,"M% SW":swShare}),"M%":null,_count:count};
  });
  const totalVol=recs.reduce((sum,r)=>sum+(r.vol||0),0);
  recs.forEach(r=>r["M%"]=totalVol?(r.vol||0)/totalVol*100:null);
  return {recs,label:`Jahressumme · ${weeks.length} KW`};
}
function renderCountryPointChips(){
  cpPoints.innerHTML=COUNTRY_POINTS.map(point=>`<button type="button" class="cp-point${cpSelected.has(point.id)?" active":""}" data-point="${esc(point.id)}" aria-pressed="${cpSelected.has(point.id)}">
    <span class="cp-box" aria-hidden="true"></span>${esc(point.label)} <span class="cp-unit">${esc(point.unit)}</span>
  </button>`).join("");
  cpPoints.querySelectorAll(".cp-point").forEach(btn=>btn.addEventListener("click",()=>{
    const id=btn.dataset.point;
    if(cpSelected.has(id)){if(cpSelected.size>1)cpSelected.delete(id);}else cpSelected.add(id);
    cpSaveState();renderCountryPoints();
  }));
}
function renderCountryPoints(){
  if(!document.getElementById("cpPoints"))return;
  cpWeek.disabled=cpMode!=="week";
  document.querySelectorAll('#cpMode button').forEach(btn=>btn.classList.toggle("active",btn.dataset.mode===cpMode));
  renderCountryPointChips();

  const selectedPoints=COUNTRY_POINTS.filter(p=>cpSelected.has(p.id));
  const {recs,label}=countryPointsRecords();
  const rows=recs.filter(rec=>selectedPoints.some(p=>cpValue(rec,p)!==null&&cpValue(rec,p)!==undefined));
  cpInfo.innerHTML=`<span class="chip">${esc(label)}</span>
    <span>${rows.length} Länder mit Daten</span>
    <span>${selectedPoints.length} von ${COUNTRY_POINTS.length} Datenpunkten gewählt</span>`;

  const chartOptions=selectedPoints.length?selectedPoints:[COUNTRY_POINTS[0]];
  if(!chartOptions.some(p=>p.id===cpChartPointId))cpChartPointId=chartOptions[0].id;
  cpChartPoint.innerHTML=chartOptions.map(p=>`<option value="${esc(p.id)}" ${p.id===cpChartPointId?"selected":""}>${esc(p.label)}</option>`).join("");
  const chartPoint=cpPointById(cpChartPointId)||chartOptions[0];
  cpChartSub.textContent=`${label} · ${chartPoint.label} (${chartPoint.unit}) je Land`;
  const chartRows=rows.map(rec=>({label:rec.land,value:cpValue(rec,chartPoint)}))
    .filter(item=>item.value!==null&&item.value!==undefined&&Number.isFinite(item.value))
    .sort((a,b)=>b.value-a.value);
  barChart("cpChart",chartRows.map((item,index)=>({
    label:item.label,value:item.value,color:colors[index%colors.length],
    formatted:format(item.value,chartPoint.type)
  })),{tick:value=>chartPoint.type==="currency"||chartPoint.type==="m3"?fmt0.format(value):fmtNum.format(value)});

  cpTableSub.textContent=`${label} · Zeilen: Länder · Spalten: ausgewählte Datenpunkte. Farbintensität je Spalte nach Wert.`;
  const columnRanges={};
  selectedPoints.forEach(point=>{
    const values=rows.map(rec=>cpValue(rec,point)).filter(v=>v!==null&&v!==undefined&&Number.isFinite(v));
    columnRanges[point.id]={min:values.length?Math.min(...values):0,max:values.length?Math.max(...values):1};
  });
  const sortPoint=selectedPoints[0];
  const sortedRows=[...rows].sort((a,b)=>(cpValue(b,sortPoint)||0)-(cpValue(a,sortPoint)||0));
  if(!selectedPoints.length){
    cpTable.innerHTML='<tbody><tr><td class="cp-empty">Mindestens einen Datenpunkt auswählen.</td></tr></tbody>';
  }else{
    cpTable.innerHTML=`<thead><tr><th>Land</th>${selectedPoints.map(p=>`<th>${esc(p.label)}<br><span class="small">${esc(p.unit)}</span></th>`).join("")}</tr></thead>
      <tbody>${sortedRows.map(rec=>`<tr>
        <td>${esc(rec.land)}</td>
        ${selectedPoints.map(point=>{
          const value=cpValue(rec,point),range=columnRanges[point.id];
          const bg=value===null||value===undefined||!Number.isFinite(value)?"":landHeatColor(value,range.min,range.max);
          return `<td style="background:${bg}">${format(value,point.type)}</td>`;
        }).join("")}
      </tr>`).join("")}</tbody>`;
  }
}
function initCountryPoints(){
  if(!document.getElementById("cpWeek"))return;
  cpLoadState();
  const weeks=availableDashboardWeeks();
  cpWeek.innerHTML=weeks.map(week=>`<option value="${week}">KW${String(week).padStart(2,"0")}</option>`).join("");
  cpWeek.value=String(Math.max(...weeks));
  cpWeek.addEventListener("change",renderCountryPoints);
  cpChartPoint.addEventListener("change",()=>{cpChartPointId=cpChartPoint.value;cpSaveState();renderCountryPoints();});
  document.querySelectorAll('#cpMode button').forEach(btn=>btn.addEventListener("click",()=>{
    cpMode=btn.dataset.mode;cpSaveState();renderCountryPoints();
  }));
}

const SAWLINE_ADDITIVE_TYPES=new Set(["lfm","pieces","fm","m3","minutes"]);
function annualSum(rows,key){return rows.reduce((sum,row)=>sum+(n(row[key])||0),0)}
function renderAnnual(){
  if(!document.getElementById("annualKpis"))return;
  const weeks=[...DATA.weekly].sort((a,b)=>a["KW Nr."]-b["KW Nr."]);
  if(!weeks.length){
    annualKpis.innerHTML='<div class="notice">Keine Wochendaten geladen.</div>';
    return;
  }
  const menge=annualSum(weeks,"Umsatzmenge gesamt (m³)");
  const dbNetto=annualSum(weeks,"DB Netto (€)");
  const revenue=weeks.reduce((sum,row)=>sum+((n(row["Umsatzmenge gesamt (m³)"])||0)*(n(row["Ø Preis gesamt (€/m³)"])||0)),0);
  const avgPrice=menge?revenue/menge:null;
  const avgDb=menge?dbNetto/menge:null;
  const weekLabel=`${weeks.length} Wochen · ${weeks[0].KW}–${weeks[weeks.length-1].KW}`;
  annualRangeText.textContent=`Aufsummierte Kennzahlen über ${weekLabel}.`;
  annualChip.textContent=`2026 · ${weeks.length} KW`;
  annualKpis.innerHTML=[
    detailKpi("Umsatzmenge gesamt",menge,"m3",weekLabel),
    detailKpi("Umsatzerlös (rechnerisch)",revenue,"currency","Menge × Ø-Preis"),
    detailKpi("Ø-Preis (mengengewichtet)",avgPrice,"price",weekLabel),
    detailKpi("DB Netto gesamt",dbNetto,"currency",weekLabel),
    detailKpi("DB je m³ (gewichtet)",avgDb,"price",weekLabel),
    detailKpi("Produktion gesamt",annualSum(weeks,"Produktion KW gesamt (fm)"),"fm","Summe Wochenleistung"),
    detailKpi("Produktion gesamt",annualSum(weeks,"Produktion KW (m³)"),"m3","Summe Wochenleistung"),
    detailKpi("RHP gesamt",annualSum(weeks,"RHP KW (fm)"),"fm","Summe Wochenleistung"),
    detailKpi("Auftragseingang gesamt",annualSum(weeks,"Auftragseingang gesamt (m³)"),"m3",weekLabel),
    detailKpi("Verladungen gesamt",annualSum(weeks,"Verladungen gesamt"),"number",weekLabel)
  ].join("");

  annualRefineSub.textContent=`Jahressumme · ${weekLabel}`;
  barChart("annualRefineChart",[
    {label:"Trocknung",value:annualSum(weeks,"Trocknung (m³)"),formatted:format(annualSum(weeks,"Trocknung (m³)"),"m3")},
    {label:"Hobelung",value:annualSum(weeks,"Hobelung (m³)"),formatted:format(annualSum(weeks,"Hobelung (m³)"),"m3")},
    {label:"Imprägnierung",value:annualSum(weeks,"Imprägnierung (m³)"),formatted:format(annualSum(weeks,"Imprägnierung (m³)"),"m3")}
  ],{tick:value=>fmt0.format(value)});

  const last=weeks[weeks.length-1];
  annualYtdSub.textContent=`Kumulierter Jahresstand aus ${last.KW} · 2026 gegenüber 2025`;
  annualYtd.innerHTML=[
    ["Produktion fm",last["Produktion YTD 2026 (fm)"],last["Produktion YTD 2025 (fm)"],"fm"],
    ["Produktion m³",last["Produktion YTD 2026 (m³)"],last["Produktion YTD 2025 (m³)"],"m3"],
    ["RHP fm",last["RHP YTD 2026 (fm)"],last["RHP YTD 2025 (fm)"],"fm"]
  ].map(([label,a,b,type])=>{
    const d=b?(a-b)/b:null;
    return `<div class="stat-row"><div><b>${label}</b><div class="small">2026: ${format(a,type)} · 2025: ${format(b,type)}</div></div><div class="delta ${deltaClass(d)}">${d===null?"–":(d>=0?"+":"")+format(d,"percent")}</div></div>`;
  }).join("");

  const categories=[...new Set(DATA.salesBreakdown.map(row=>row.Kategorie))];
  const topTotal=categories.filter(cat=>!cat.toLowerCase().startsWith("davon "))
    .reduce((sum,cat)=>sum+annualSum(DATA.salesBreakdown.filter(r=>r.Kategorie===cat),"Menge (m³)"),0);
  const salesRows=categories.map(cat=>{
    const rows=DATA.salesBreakdown.filter(r=>r.Kategorie===cat);
    const catMenge=annualSum(rows,"Menge (m³)");
    const priced=rows.filter(r=>n(r["EUR (€/m³)"])!==null&&n(r["Menge (m³)"])!==null&&n(r["Menge (m³)"])>0);
    const priceRevenue=priced.reduce((sum,r)=>sum+n(r["Menge (m³)"])*n(r["EUR (€/m³)"]),0);
    const priceMenge=priced.reduce((sum,r)=>sum+n(r["Menge (m³)"]),0);
    return {
      "Kategorie":cat,"Menge (m³)":catMenge,
      "Ø-Preis gew.":priceMenge?priceRevenue/priceMenge:null,
      "Anteil %":topTotal?catMenge/topTotal*100:null
    };
  });
  renderTable("annualSalesTable",salesRows,[
    ["Kategorie","salesCategory"],["Menge (m³)","m3"],["Ø-Preis gew.","price"],["Anteil %","pctpoint"]
  ]);

  const prodMetrics=[...new Set(DATA.productionCurrent.map(row=>row.Kennzahl))];
  const prodRows=prodMetrics.map(metric=>{
    const rows=DATA.productionCurrent.filter(r=>r.Kennzahl===metric);
    return {"Kennzahl":metric,"Summe (Jahr)":annualSum(rows,"Aktuell"),"Einheit":rows[0]?.Einheit||"fm"};
  });
  renderTable("annualProductionTable",prodRows,[
    ["Kennzahl","text"],["Summe (Jahr)","productionValue"]
  ]);

  const sawMetrics=[...new Map(DATA.sawlineReports.map(row=>[row.KPI,row])).values()];
  const sawRows=sawMetrics.map(sample=>{
    const rows=DATA.sawlineReports.filter(r=>r.KPI===sample.KPI);
    const valid=rows.map(r=>n(r.Summe)).filter(v=>v!==null);
    const additive=SAWLINE_ADDITIVE_TYPES.has(sample.Werttyp);
    const value=additive
      ?valid.reduce((s,v)=>s+v,0)
      :(valid.length?valid.reduce((s,v)=>s+v,0)/valid.length:null);
    return {kpi:sample.KPI,value,type:sample.Werttyp,agg:additive?"Summe":"Ø",weeks:valid.length};
  });
  const annualSaw=document.getElementById("annualSawlineTable");
  annualSaw.innerHTML=`<thead><tr><th>Kennzahl</th><th>Jahreswert</th><th>Aggregat</th><th>Wochen</th></tr></thead>
    <tbody>${sawRows.map(row=>`<tr>
      <td>${esc(row.kpi)}</td>
      <td class="num">${format(row.value,row.type)}</td>
      <td>${row.agg}</td>
      <td class="num">${row.weeks}</td>
    </tr>`).join("")}</tbody>`;
}
/* ============================= Historie (Zeitstrahl) ============================= */
/* Die Historie greift auf dieselben Daten wie das übrige Dashboard zu – alle hochgeladenen
   Excel-Dateien. Für jede Quelle wird ein Datensatz gebildet; ausgewählte Kennzahlen/Produkte
   werden je Kalenderwoche über einen Zeitraum dargestellt. Es werden ausschließlich die
   eingelesenen Werte verwendet – nichts wird erzeugt oder übersetzt. */
function historyYearFromFile(name,fallback){
  const m=String(name||"").match(/(20\d{2})/);
  return m?Number(m[1]):fallback;
}
function historyDashboardYear(){
  // Jahr des geladenen Wochenberichts (aus Quelldatei), Fallback 2026.
  const wk=(DATA.weekly&&DATA.weekly[0])||null;
  return wk?historyYearFromFile(wk.Quelldatei,2026):2026;
}
function historyRowYear(row,fallback){
  if(row&&row.Jahr!==undefined&&row.Jahr!==null&&row.Jahr!=="")return Number(row.Jahr);
  const y=historyYearFromFile(row&&row.Quelldatei,null);
  return y||fallback;
}
/* Eigener Mehrjahres-Speicher NUR für die Historie: sammelt alle hochgeladenen Wochen über
   alle Jahre, ohne die (einjährige) Logik der übrigen Fenster zu verändern. */
function historyInitStores(){
  const sy=historyDashboardYear();
  DATA.weeklyHistory=(DATA.weekly||[]).map(r=>({...r,Jahr:historyRowYear(r,sy)}));
  DATA.salesHistory=(DATA.salesBreakdown||[]).map(r=>({...r,Jahr:historyRowYear(r,sy)}));
}
function historyEnsureStores(){
  if(!Array.isArray(DATA.weeklyHistory)||!Array.isArray(DATA.salesHistory))historyInitStores();
}
function historyUpsertStore(store,rows,year,week){
  const kept=(store||[]).filter(r=>!(Number(r.Jahr)===Number(year)&&Number(r["KW Nr."])===Number(week)));
  (rows||[]).forEach(r=>{ if(r)kept.push({...r,Jahr:Number(year)}); });
  return kept;
}
function historyRecordBundle(bundle){
  historyEnsureStores();
  const year=bundle.year||historyDashboardYear(),week=bundle.week;
  if(bundle.weekly)DATA.weeklyHistory=historyUpsertStore(DATA.weeklyHistory,[bundle.weekly],year,week);
  if(Array.isArray(bundle.salesBreakdown))DATA.salesHistory=historyUpsertStore(DATA.salesHistory,bundle.salesBreakdown,year,week);
}
/* Baut aus normalisierten Datensätzen {zeile,name,unit,type,year,kw,value} ein Historie-Dataset. */
function historyBuildDataset(id,label,records,defUnit,defType){
  if(!records.length)return null;
  const artMap=new Map(),vmap=new Map(),years=new Set(),weeksByYear={};
  records.forEach(r=>{
    if(!artMap.has(r.zeile))artMap.set(r.zeile,{zeile:r.zeile,name:r.name,unit:r.unit||defUnit,type:r.type||defType});
    vmap.set(r.zeile+"|"+r.year+"|"+r.kw,r.value);
    years.add(r.year);
    (weeksByYear[r.year]=weeksByYear[r.year]||new Set()).add(r.kw);
  });
  const byYear={};Object.entries(weeksByYear).forEach(([y,s])=>byYear[y]=[...s].sort((a,b)=>a-b));
  return {
    id,label,unit:defUnit,type:defType,
    articles:[...artMap.values()].sort((a,b)=>a.zeile-b.zeile),
    years:[...years].sort((a,b)=>a-b),
    weeksByYear:byYear,
    valueAt:(zeile,year,kw)=>{const v=vmap.get(zeile+"|"+year+"|"+kw);return v===undefined?null:n(v);}
  };
}
function historyUnitTypeForWeeklyKey(key){
  const k=key.toLowerCase();
  if(/€\/m³|\(€\/m³\)/.test(key))return{unit:"€/m³",type:"price"};
  if(/\(€\)/.test(key))return{unit:"€",type:"currency"};
  if(/\(m³\)/.test(key))return{unit:"m³",type:"m3"};
  if(/\(fm\)/.test(key))return{unit:"fm",type:"fm"};
  if(/quote/.test(k))return{unit:"%",type:"percent"};
  return{unit:"",type:"number"};
}
function historyBuildAllDatasets(){
  const list=[],dy=historyDashboardYear();
  historyEnsureStores();
  const salesSrc=DATA.salesHistory&&DATA.salesHistory.length?DATA.salesHistory:(DATA.salesBreakdown||[]);
  const weeklySrc=DATA.weeklyHistory&&DATA.weeklyHistory.length?DATA.weeklyHistory:(DATA.weekly||[]);
  // 1./2. Umsatzuntergliederung: Ø-Preis (€/m³) und Menge (m³) je Produkt
  if(salesSrc.length){
    const cats=[];salesSrc.forEach(r=>{if(!cats.includes(r.Kategorie))cats.push(r.Kategorie);});
    const zeileOf=cat=>3+cats.indexOf(cat);
    const priceRecs=salesSrc.map(r=>({zeile:zeileOf(r.Kategorie),name:r.Kategorie,unit:"€/m³",type:"price",year:historyRowYear(r,dy),kw:r["KW Nr."],value:r["EUR (€/m³)"]}));
    const mengeRecs=salesSrc.map(r=>({zeile:zeileOf(r.Kategorie),name:r.Kategorie,unit:"m³",type:"m3",year:historyRowYear(r,dy),kw:r["KW Nr."],value:r["Menge (m³)"]}));
    // Gesamt-Durchschnittspreis bzw. Gesamtmenge aus der Gesamt-Zeile des Wochenberichts (Zeile 2 = ganz oben)
    weeklySrc.forEach(w=>{
      const yr=historyRowYear(w,dy),kw=w["KW Nr."];
      priceRecs.push({zeile:2,name:"Gesamt (Ø-Preis)",unit:"€/m³",type:"price",year:yr,kw,value:w["Ø Preis gesamt (€/m³)"]});
      mengeRecs.push({zeile:2,name:"Gesamt (Menge)",unit:"m³",type:"m3",year:yr,kw,value:w["Umsatzmenge gesamt (m³)"]});
    });
    const dPrice=historyBuildDataset("umsatzPreis","Umsatz · Ø-Preis je Produkt (€/m³)",priceRecs,"€/m³","price");
    const dMenge=historyBuildDataset("umsatzMenge","Umsatz · Menge je Produkt (m³)",mengeRecs,"m³","m3");
    if(dPrice)list.push(dPrice);
    if(dMenge)list.push(dMenge);
  }
  // 3. Wochenkennzahlen (Wochenbericht) – alle numerischen Spalten als Kennzahlen
  if(weeklySrc.length){
    const skip=new Set(["KW","KW Nr.","Quelldatei","Jahr"]);
    const keys=Object.keys(weeklySrc[0]).filter(k=>!skip.has(k)&&weeklySrc.some(r=>typeof r[k]==="number"));
    const recs=[];
    keys.forEach((key,idx)=>{
      const ut=historyUnitTypeForWeeklyKey(key);
      weeklySrc.forEach(r=>{
        recs.push({zeile:idx,name:key,unit:ut.unit,type:ut.type,year:historyRowYear(r,dy),kw:r["KW Nr."],value:r[key]});
      });
    });
    const d=historyBuildDataset("wochenKennzahlen","Wochenkennzahlen (Wochenbericht)",recs,"","number");
    if(d)list.push(d);
  }
  // 4. Sägelinie (Wochenprotokolle) – Wochensumme je Kennzahl
  if(Array.isArray(DATA.sawlineReports)&&DATA.sawlineReports.length){
    const order=[];
    DATA.sawlineReports.forEach(r=>{if(!order.some(o=>o.kpi===r.KPI))order.push({kpi:r.KPI,zeile:r.Zeile,typ:r.Werttyp});});
    const recs=DATA.sawlineReports.map(r=>({zeile:r.Zeile,name:r.KPI,unit:r.Einheit||"",type:r.Werttyp||"number",year:Number(r.Jahr)||dy,kw:r["KW Nr."],value:r.Summe}));
    const d=historyBuildDataset("saegelinie","Sägelinie (Wochenprotokolle)",recs,"","number");
    if(d)list.push(d);
  }
  return list;
}
let _historyDatasetsCache=null;
function historyResetDatasets(){_historyDatasetsCache=null;}
function historyDatasets(){
  if(!_historyDatasetsCache)_historyDatasetsCache=historyBuildAllDatasets();
  return _historyDatasetsCache;
}
function historyDatasetById(id){
  const all=historyDatasets();
  return all.find(d=>d.id===id)||all[0]||null;
}
function historyArticles(ds){
  return ds.articles.map(a=>({zeile:a.zeile,name:a.name,unit:a.unit,type:a.type}));
}
function historyArticleMeta(ds,zeile){
  return ds.articles.find(a=>a.zeile===zeile)||{zeile,name:"",unit:ds.unit,type:ds.type};
}
function historyYears(ds){return ds.years.slice();}
function historyWeeks(ds){
  return [...new Set(Object.values(ds.weeksByYear).flat())].sort((a,b)=>a-b);
}
function historyWeeksForYear(ds,year){
  return (ds.weeksByYear[year]||[]).slice();
}
/* Fortlaufende Perioden von (Jahr von, KW von) bis (Jahr bis, KW bis) über Jahresgrenzen. */
function historyPeriods(ds,yFrom,kwFrom,yTo,kwTo){
  const periods=[];
  for(let y=yFrom;y<=yTo;y++){
    const wks=historyWeeksForYear(ds,y);
    if(!wks.length)continue;
    let lo=wks[0],hi=wks[wks.length-1];
    if(y===yFrom)lo=Math.max(lo,kwFrom);
    if(y===yTo)hi=Math.min(hi,kwTo);
    wks.filter(w=>w>=lo&&w<=hi).forEach(w=>periods.push({year:y,kw:w}));
  }
  return periods;
}
function historyKwLabel(n){return "KW"+String(n).padStart(2,"0");}
function historyFillSelect(sel,items,value){
  if(!sel)return;
  sel.innerHTML=items.map(it=>`<option value="${esc(String(it.value))}">${esc(it.label)}</option>`).join("");
  if(value!==undefined&&items.some(it=>String(it.value)===String(value)))sel.value=String(value);
}
let historySelected=new Set();   // ausgewählte Artikel-Zeilen (mehrere Produkte)
function historyColorForZeile(ds,zeile){
  const arts=historyArticles(ds);
  const idx=arts.findIndex(a=>a.zeile===zeile);
  return colors[(idx<0?0:idx)%colors.length];
}
function historyDefaultSelection(ds){
  const arts=historyArticles(ds);
  // Beispielprodukte des Nutzers bevorzugen (echte Kategorienamen)
  const wanted=["gesamt","hauptware säge","davon bretter","davon contreventement","davon voliges","latten"];
  const picked=arts.filter(a=>wanted.some(w=>a.name.toLowerCase().includes(w))).map(a=>a.zeile);
  return picked.length?picked:arts.slice(0,Math.min(5,arts.length)).map(a=>a.zeile);
}
function renderHistoryArticleChips(ds){
  const host=document.getElementById("historyArticles");
  if(!host)return;
  host.innerHTML=historyArticles(ds).map(a=>{
    const on=historySelected.has(a.zeile);
    const col=historyColorForZeile(ds,a.zeile);
    return `<button type="button" class="hist-point${on?" active":""}" data-zeile="${a.zeile}" aria-pressed="${on}">
      <span class="hp-box"></span>
      <span class="hp-dot" style="background:${col}"></span>
      <span>${esc(a.name)}</span>
      <span class="hp-zeile">Z${a.zeile}</span>
    </button>`;
  }).join("");
  host.querySelectorAll(".hist-point").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const z=Number(btn.dataset.zeile);
      if(historySelected.has(z))historySelected.delete(z); else historySelected.add(z);
      renderHistoryArticleChips(ds);
      renderHistory();
    });
  });
}
/* Nach einem Upload/Datenwechsel die Historie-Auswahllisten neu aufbauen (ohne Listener doppelt
   zu binden). Datensatz und Produktauswahl bleiben erhalten; der Zeitraum wird auf die volle
   Spanne gesetzt, damit neu geladene Jahre/Wochen sofort sichtbar sind. */
function refreshHistoryControls(){
  const dsSel=document.getElementById("historyDataset");
  if(!dsSel)return;
  historyResetDatasets();
  const datasets=historyDatasets();
  if(!datasets.length){renderHistory();return;}
  const prevDs=dsSel.value;
  historyFillSelect(dsSel,datasets.map(d=>({value:d.id,label:d.label})),datasets.some(d=>d.id===prevDs)?prevDs:datasets[0].id);
  const ds=historyDatasetById(dsSel.value);
  const artZ=new Set(historyArticles(ds).map(a=>a.zeile));
  const keep=[...historySelected].filter(z=>artZ.has(z));
  historySelected=new Set(keep.length?keep:historyDefaultSelection(ds));
  renderHistoryArticleChips(ds);
  const years=historyYears(ds);
  historyFillSelect(document.getElementById("historyYearFrom"),years.map(y=>({value:y,label:String(y)})),years[0]);
  historyFillSelect(document.getElementById("historyYearTo"),years.map(y=>({value:y,label:String(y)})),years[years.length-1]);
  const weeks=historyWeeks(ds);
  historyFillSelect(document.getElementById("historyFrom"),weeks.map(w=>({value:w,label:historyKwLabel(w)})),weeks[0]);
  historyFillSelect(document.getElementById("historyTo"),weeks.map(w=>({value:w,label:historyKwLabel(w)})),weeks[weeks.length-1]);
  renderHistory();
}
function initHistory(){
  const dsSel=document.getElementById("historyDataset");
  if(!dsSel)return;
  // Listener einmalig anhängen – unabhängig davon, ob schon Daten geladen sind
  // (die Selects existieren immer; ihre Optionen werden später befüllt).
  ["historyDataset","historyYearFrom","historyYearTo","historyFrom","historyTo"].forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.addEventListener("change",()=>onHistoryControlChange(id));
  });
  const resSel=document.getElementById("historyResolution");
  if(resSel)resSel.addEventListener("change",renderHistory);
  const allBtn=document.getElementById("historyAll"),noneBtn=document.getElementById("historyNone");
  if(allBtn)allBtn.addEventListener("click",()=>{
    const d=historyDatasetById(document.getElementById("historyDataset").value);
    if(!d)return;
    historySelected=new Set(historyArticles(d).map(a=>a.zeile));renderHistoryArticleChips(d);renderHistory();
  });
  if(noneBtn)noneBtn.addEventListener("click",()=>{
    const d=historyDatasetById(document.getElementById("historyDataset").value);
    if(!d)return;
    historySelected=new Set();renderHistoryArticleChips(d);renderHistory();
  });
  // Datenabhängige Erstbefüllung
  historyResetDatasets();
  const datasets=historyDatasets();
  historyFillSelect(dsSel,datasets.map(d=>({value:d.id,label:d.label})));
  const ds=datasets[0];
  if(!ds){renderHistory();return;}
  historySelected=new Set(historyDefaultSelection(ds));
  renderHistoryArticleChips(ds);
  const years=historyYears(ds);
  historyFillSelect(document.getElementById("historyYearFrom"),years.map(y=>({value:y,label:String(y)})),years[0]);
  historyFillSelect(document.getElementById("historyYearTo"),years.map(y=>({value:y,label:String(y)})),years[years.length-1]);
  const weeks=historyWeeks(ds);
  historyFillSelect(document.getElementById("historyFrom"),weeks.map(w=>({value:w,label:historyKwLabel(w)})),weeks[0]);
  historyFillSelect(document.getElementById("historyTo"),weeks.map(w=>({value:w,label:historyKwLabel(w)})),weeks[weeks.length-1]);
}
function onHistoryControlChange(changed){
  const ds=historyDatasetById(document.getElementById("historyDataset").value);
  if(!ds)return;
  if(changed==="historyDataset"){
    historySelected=new Set(historyDefaultSelection(ds));
    renderHistoryArticleChips(ds);
    const years=historyYears(ds);
    historyFillSelect(document.getElementById("historyYearFrom"),years.map(y=>({value:y,label:String(y)})),years[0]);
    historyFillSelect(document.getElementById("historyYearTo"),years.map(y=>({value:y,label:String(y)})),years[years.length-1]);
    const weeks=historyWeeks(ds);
    historyFillSelect(document.getElementById("historyFrom"),weeks.map(w=>({value:w,label:historyKwLabel(w)})),weeks[0]);
    historyFillSelect(document.getElementById("historyTo"),weeks.map(w=>({value:w,label:historyKwLabel(w)})),weeks[weeks.length-1]);
  }
  // (Jahr von, KW von) darf nicht nach (Jahr bis, KW bis) liegen
  const yF=document.getElementById("historyYearFrom"),kF=document.getElementById("historyFrom"),
        yT=document.getElementById("historyYearTo"),kT=document.getElementById("historyTo");
  if(yF&&kF&&yT&&kT){
    const ordF=Number(yF.value)*100+Number(kF.value),ordT=Number(yT.value)*100+Number(kT.value);
    if(ordF>ordT){
      const fromSide=(changed==="historyYearFrom"||changed==="historyFrom");
      if(fromSide){yT.value=yF.value;kT.value=kF.value;}
      else{yF.value=yT.value;kF.value=kT.value;}
    }
  }
  renderHistory();
}
function renderHistory(){
  const stack=document.getElementById("historyStack");
  if(!stack)return;
  historyResetDatasets();
  const ds=historyDatasetById((document.getElementById("historyDataset")||{}).value);
  const scopeChip=document.getElementById("historyScope");
  const kpiHost=document.getElementById("historyKpis");
  const tableHost=document.getElementById("historyTable");
  if(!ds){
    if(scopeChip)scopeChip.textContent="Keine historischen Daten geladen";
    stack.innerHTML='<div class="history-stack-empty">Keine historischen Daten vorhanden.</div>';
    kpiHost.innerHTML="";tableHost.innerHTML="";
    document.getElementById("historyTableSub").textContent="";
    return;
  }
  const yFrom=Number(document.getElementById("historyYearFrom").value);
  const yTo=Number(document.getElementById("historyYearTo").value);
  const kFrom=Number(document.getElementById("historyFrom").value);
  const kTo=Number(document.getElementById("historyTo").value);
  const periods=historyPeriods(ds,yFrom,kFrom,yTo,kTo);
  const multiYear=yFrom!==yTo;
  const arts=historyArticles(ds);
  const selected=arts.filter(a=>historySelected.has(a.zeile));
  const valOf=(zeile,year,kw)=>ds.valueAt(zeile,year,kw);
  const rangeLabel=multiYear
    ? `${historyKwLabel(kFrom)}/${yFrom} – ${historyKwLabel(kTo)}/${yTo}`
    : `${historyKwLabel(kFrom)}–${historyKwLabel(kTo)} ${yFrom}`;

  // Auflösung: Kalenderwochen oder Quartale (KW zu Q1–Q4 zusammengefasst)
  const resolution=(document.getElementById("historyResolution")||{}).value||"week";
  const isSumType=type=>new Set(["m3","fm","lfm","pieces","minutes","currency"]).has(type);
  const quarterOf=kw=>Math.min(4,Math.max(1,Math.ceil(kw/13)));
  let points,pointLabel,pointValue,axisLabel,resLabel;
  if(resolution==="quarter"){
    const buckets=[],bmap=new Map();
    periods.forEach(p=>{const q=quarterOf(p.kw),key=p.year+"-"+q;if(!bmap.has(key)){const bk={year:p.year,quarter:q,weeks:[]};bmap.set(key,bk);buckets.push(bk);}bmap.get(key).weeks.push(p);});
    points=buckets;
    pointLabel=b=>multiYear?`Q${b.quarter}/${String(b.year).slice(2)}`:`Q${b.quarter}`;
    pointValue=(art,b)=>{const vals=b.weeks.map(p=>valOf(art.zeile,p.year,p.kw)).filter(v=>v!==null&&Number.isFinite(v));if(!vals.length)return null;const s=vals.reduce((a,c)=>a+c,0);return isSumType(art.type)?s:s/vals.length;};
    axisLabel="Quartal";resLabel="Quartale";
  }else{
    points=periods;
    pointLabel=p=>multiYear?historyKwLabel(p.kw)+"·"+String(p.year).slice(2):historyKwLabel(p.kw);
    pointValue=(art,p)=>valOf(art.zeile,p.year,p.kw);
    axisLabel="KW";resLabel="KW";
  }
  const labels=points.map(pointLabel);
  // Scope-Chip
  if(scopeChip){
    scopeChip.textContent=`${selected.length} Kennzahlen · ${multiYear?`${yFrom}–${yTo}`:yFrom} · ${points.length} ${resLabel}`;
  }
  if(!selected.length||!points.length){
    stack.innerHTML=`<div class="history-stack-empty">${selected.length?"Kein gültiger Zeitraum gewählt.":"Bitte oben mindestens eine Kennzahl auswählen."}</div>`;
    kpiHost.innerHTML="";tableHost.innerHTML="";
    document.getElementById("historyTableSub").textContent="";
    return;
  }
  // KPI je Kennzahl: aktueller Wert (letzter Punkt) + Veränderung über den Zeitraum
  kpiHost.innerHTML=selected.map(a=>{
    const meta0=historyArticleMeta(ds,a.zeile);
    const vals=points.map(pt=>pointValue(a,pt));
    const firstV=vals.find(v=>v!==null),lastV=[...vals].reverse().find(v=>v!==null);
    let meta=rangeLabel;
    if(firstV!=null&&lastV!=null&&firstV!==0){
      const d=(lastV-firstV)/firstV*100;
      meta=`${d>=0?"+":""}${fmt2.format(d)} % im Zeitraum`;
    }
    return detailKpi(a.name,lastV??null,meta0.type,meta);
  }).join("");
  // Ein fortlaufender Zeitstrahl je Kennzahl (untereinander), gleiche Zeitachse
  stack.innerHTML="";
  selected.forEach(a=>{
    const am=historyArticleMeta(ds,a.zeile);
    const chartId=`historyChart_${a.zeile}`;
    const card=document.createElement("div");
    card.className="card";
    card.innerHTML=`<div class="card-title-row">
        <div><h3>${esc(a.name)}</h3><div class="card-sub">${esc(rangeLabel)}${am.unit?" · "+esc(am.unit):""}${resolution==="quarter"?" · Quartalswerte":""}</div></div>
        <span class="chip" data-trend="${a.zeile}"></span>
      </div>
      <div class="chart" id="${chartId}"></div>`;
    stack.append(card);
    const series=[{name:a.name,color:historyColorForZeile(ds,a.zeile),values:points.map(pt=>pointValue(a,pt)),format:v=>format(v,am.type)}];
    lineChart(chartId,labels,series,{tick:v=>fmt0.format(v)});
    // Trend-Chip
    const vals=series[0].values;
    const fV=vals.find(v=>v!==null),lV=[...vals].reverse().find(v=>v!==null);
    const chip=card.querySelector(`[data-trend="${a.zeile}"]`);
    if(chip&&fV!=null&&lV!=null&&fV!==0){
      const d=(lV-fV)/fV*100;
      chip.textContent=`${d>=0?"+":""}${fmt2.format(d)} %`;
      chip.style.color=d>=0?"#2f7d32":"#b23b3b";
    }
  });
  // Vergleichstabelle: Punkt × Kennzahl (je Kennzahl eigene Einheit)
  const selMeta=selected.map(a=>historyArticleMeta(ds,a.zeile));
  const head=`<thead><tr><th>${axisLabel}</th>${multiYear?"<th>Jahr</th>":""}${selected.map(a=>`<th>${esc(a.name)}</th>`).join("")}</tr></thead>`;
  const body=points.map(pt=>{
    const cells=selected.map((a,i)=>{const v=pointValue(a,pt);return `<td>${v==null?"–":format(v,selMeta[i].type)}</td>`;}).join("");
    const rowLabel=resolution==="quarter"?`Q${pt.quarter}`:historyKwLabel(pt.kw);
    return `<tr><td><b>${rowLabel}</b></td>${multiYear?`<td>${pt.year}</td>`:""}${cells}</tr>`;
  }).join("");
  tableHost.innerHTML=head+"<tbody>"+body+"</tbody>";
  document.getElementById("historyTableSub").textContent=`${rangeLabel} · ${selected.length} Kennzahlen · ${resolution==="quarter"?"Quartale (Ø bei Preisen, Summe bei Mengen)":"Kalenderwochen"} · Quelle: ${ds.label}`;
}

/* ============================= Infrastruktur · Datenverfügbarkeit ============================= */
function infraHasKey(obj,key){return !!obj&&n(obj[key])!==null;}
const INFRA_WEEKLY_KPIS=[
  ["Umsatz je Produkt",b=>(b.salesBreakdown||[]).some(r=>n(r["EUR (€/m³)"])!==null)],
  ["Ø-Preis gesamt",b=>infraHasKey(b.weekly,"Ø Preis gesamt (€/m³)")],
  ["Umsatzmenge",b=>infraHasKey(b.weekly,"Umsatzmenge gesamt (m³)")],
  ["Deckungsbeitrag",b=>infraHasKey(b.weekly,"DB Netto (€)")&&infraHasKey(b.weekly,"DB (€/m³)")],
  ["Länderanteile",b=>(b.countryComparison||[]).some(r=>n(r["M%"])!==null)],
  ["Länderpreise",b=>(b.countryComparison||[]).some(r=>n(r["Ø-Preis Gesamt"])!==null)],
  ["Veredelung",b=>n(b.refinement&&b.refinement.Trocknung&&b.refinement.Trocknung.total)!==null],
  ["Produktion",b=>n(b.production&&b.production["Gesamt Fm"]&&b.production["Gesamt Fm"].current)!==null],
  ["A-Eingang",b=>n(b.incoming&&b.incoming.total)!==null],
  ["Auftragsbestand",b=>infraHasKey(b.weekly,"Auftragsbestand 8W gesamt (m³)")],
  ["Lagerbestand",b=>infraHasKey(b.weekly,"Lagerbestand (m³)")],
  ["Verladungen",b=>infraHasKey(b.weekly,"Verladungen gesamt")]
];
function infraCheckCell(ok){return `<td class="infra-check ${ok?"infra-ok":"infra-bad"}" title="${ok?"verfügbar":"fehlt"}">${ok?"✓":"✗"}</td>`;}
function infraPlausiCell(weekly){
  const p=shipmentPlausibility(weekly);
  if(!p)return `<td class="infra-check infra-neutral" title="nicht prüfbar – Verladungen oder Umsatzmenge fehlt">–</td>`;
  const title=`Umsatzmenge ${fmtNum.format(p.umsatz)} m³ ${p.ok?"≤":">"} Verladekapazität ${fmt0.format(p.verladungen)} × 40 = ${fmtNum.format(p.x)} m³ + 1 % (${fmtNum.format(p.limit)} m³)`;
  return `<td class="infra-check ${p.ok?"infra-ok":"infra-bad"}" title="${esc(title)}">${p.ok?"✓":"✗"}</td>`;
}
function renderInfrastructure(){
  const weeklyTable=document.getElementById("infraWeeklyTable");
  if(!weeklyTable)return;
  // --- Wochenberichte ---
  const bundles=[...(DATA._weeklyBundles||[])].sort((a,b)=>Number(a.year)-Number(b.year)||Number(a.week)-Number(b.week));
  const kpiHead=INFRA_WEEKLY_KPIS.map(k=>`<th class="infra-kpi">${esc(k[0])}</th>`).join("");
  if(!bundles.length){
    weeklyTable.innerHTML=`<tbody><tr><td class="infra-empty">Noch keine Wochenberichte hochgeladen.</td></tr></tbody>`;
    document.getElementById("infraWeeklySub").textContent="Keine Wochenberichte hochgeladen.";
  }else{
    let prevYear=null;
    const body=bundles.map(b=>{
      const yearStart=Number(b.year)!==prevYear;prevYear=Number(b.year);
      const checks=INFRA_WEEKLY_KPIS.map(k=>{let ok=false;try{ok=!!k[1](b);}catch(e){ok=false;}return infraCheckCell(ok);}).join("");
      return `<tr class="${yearStart?"infra-year-start":""}">
        <td class="infra-yr">${esc(String(b.year))}</td>
        <td class="infra-kw">KW${String(b.week).padStart(2,"0")}</td>
        <td class="infra-file">${esc(b.fileName||`KW-${String(b.week).padStart(2,"0")}-${b.year}.xlsx`)}</td>
        ${checks}${infraPlausiCell(b.weekly)}</tr>`;
    }).join("");
    weeklyTable.innerHTML=`<thead><tr><th>Jahr</th><th>KW</th><th>Datei</th>${kpiHead}<th class="infra-kpi infra-plausi" title="Anzahl Verladungen × 40 m³ darf die Umsatzmenge (+1 % Toleranz) nicht übersteigen">Plausibilität Verladung</th></tr></thead><tbody>${body}</tbody>`;
    const fullyClean=bundles.filter(b=>INFRA_WEEKLY_KPIS.every(k=>{try{return !!k[1](b);}catch(e){return false;}})).length;
    const plausiResults=bundles.map(b=>shipmentPlausibility(b.weekly)).filter(Boolean);
    const plausiOk=plausiResults.filter(p=>p.ok).length;
    document.getElementById("infraWeeklySub").textContent=`${bundles.length} Datei(en) · ${fullyClean} vollständig sauber · ${INFRA_WEEKLY_KPIS.length} Kennzahlen geprüft · Plausibilität Verladung: ${plausiOk}/${plausiResults.length} OK`;
  }
  // --- Sägelinie ---
  const sawTable=document.getElementById("infraSawlineTable"),sawCard=document.getElementById("infraSawlineCard");
  const saw=DATA.sawlineReports||[];
  if(!saw.length){
    if(sawCard)sawCard.style.display="none";
  }else{
    if(sawCard)sawCard.style.display="";
    // Kennzahlen (Zeilen) in stabiler Reihenfolge
    const kpiOrder=[...new Map(saw.map(r=>[r.KPI,r.Zeile])).entries()].sort((a,b)=>Number(a[1])-Number(b[1])).map(e=>e[0]);
    // Dateien gruppieren (Jahr, KW, Quelldatei)
    const files=new Map();
    saw.forEach(r=>{
      const key=`${r.Jahr}|${r["KW Nr."]}|${r.Quelldatei}`;
      if(!files.has(key))files.set(key,{year:Number(r.Jahr),week:Number(r["KW Nr."]),file:r.Quelldatei,byKpi:{}});
      files.get(key).byKpi[r.KPI]=r.Summe;
    });
    const rows=[...files.values()].sort((a,b)=>a.year-b.year||a.week-b.week);
    const sawHead=kpiOrder.map(k=>`<th class="infra-kpi">${esc(k)}</th>`).join("");
    let prevY=null;
    const body=rows.map(f=>{
      const yearStart=f.year!==prevY;prevY=f.year;
      const checks=kpiOrder.map(k=>infraCheckCell(n(f.byKpi[k])!==null)).join("");
      return `<tr class="${yearStart?"infra-year-start":""}">
        <td class="infra-yr">${esc(String(f.year))}</td>
        <td class="infra-kw">KW${String(f.week).padStart(2,"0")}</td>
        <td class="infra-file">${esc(f.file||"")}</td>
        ${checks}</tr>`;
    }).join("");
    sawTable.innerHTML=`<thead><tr><th>Jahr</th><th>KW</th><th>Datei</th>${sawHead}</tr></thead><tbody>${body}</tbody>`;
    document.getElementById("infraSawlineSub").textContent=`${rows.length} Datei(en) · ${kpiOrder.length} Kennzahlen geprüft`;
  }
  const scope=document.getElementById("infraScope");
  if(scope)scope.textContent=`${bundles.length} Wochenberichte · ${new Set(saw.map(r=>`${r.Jahr}|${r["KW Nr."]}`)).size} Sägelinien-Wochen`;
}
function updateAll(){
  renderCountryPoints();
  if(typeof renderAssistantStatic==="function"&&document.getElementById("assistantExamples"))renderAssistantStatic();
  renderSales();renderEinkauf();renderProduction();renderSawline();renderKpis();renderOverviewCharts();renderTrends();renderAnnual();renderStatisticsBoard();renderQuality();
  renderLand();renderCountryComparison();renderWorldMap();renderDetails();renderHistory();renderInfrastructure();renderComparison();renderWallboard();
  renderKpiWorkspace();
  applyClosableStandardWindows();
  const hint=document.getElementById("emptyDataHint");
  if(hint){
    const hasData=(DATA.weekly&&DATA.weekly.length)||(DATA.sawlineReports&&DATA.sawlineReports.length)||(DATA.salesBreakdown&&DATA.salesBreakdown.length);
    hint.hidden=!!hasData;
  }
}
loadClosedStandardWindows();historyInitStores();applyStoredPurchasing();applyStoredImports();initControls();updateAll();
window.addEventListener("resize",()=>{clearTimeout(window.__rt);window.__rt=setTimeout(updateAll,120)});









