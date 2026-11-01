import type { MapPoint } from '../types';

export interface MapDocOptions {
  center: [number, number];
  points: MapPoint[];
  radiusKm?: number;
  zoom?: number;
  interactivePick?: boolean;
}

/**
 * Generates a self-contained HTML document (for iframe srcDoc) rendering a Leaflet 1.9.4 map
 * with OpenStreetMap tiles, draggable pin, and an offline SVG fallback.
 * Emits { type: 'mapPick', lat, lng } (matching prototype) and { type: 'fscm:pick-coords', lat, lng }
 * whenever the user clicks or drags the pin on the map.
 */
export function buildWarehouseMapDoc({
  center,
  points,
  radiusKm = 20,
  zoom = 12,
  interactivePick = false,
}: MapDocOptions): string {
  const safeCenter: [number, number] = [
    Number.isFinite(center[0]) ? center[0] : 10.8744,
    Number.isFinite(center[1]) ? center[1] : 106.6511,
  ];
  const ptsJson = JSON.stringify(points).replace(/</g, '\\u003c');
  const centerJson = JSON.stringify(safeCenter);
  const radMeters = (radiusKm || 0) * 1000;
  const pickEnabled = interactivePick ? 'true' : 'false';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  html,body,#m{height:100%;margin:0;padding:0;font-family:Inter,system-ui,sans-serif;background:#EEF2EC}
  .lg{position:absolute;bottom:10px;left:10px;z-index:999;background:#fff;padding:6px 12px;border-radius:6px;border:1px solid #CBD5E1;font-size:11.5px;box-shadow:0 1px 3px rgba(0,0,0,.1);display:flex;gap:12px;align-items:center;flex-wrap:wrap}
  .dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px;vertical-align:middle}
  .pick-hint{color:#14655B;font-weight:700}
  #fb{display:none;height:100%;width:100%;position:relative;background:#EEF2EE}
  #fb svg{width:100%;height:100%}
</style></head><body>
<div id="m"></div>
<div id="fb"><svg viewBox="0 0 800 380" preserveAspectRatio="xMidYMid meet"></svg></div>
<div class="lg">
  <span><i class="dot" style="background:#0F766E"></i>Kho vùng</span>
  <span><i class="dot" style="background:#7C3AED"></i>Kho tổng</span>
  <span><i class="dot" style="background:#D97706"></i>Điểm bán (Retailer)</span>
  <span><i class="dot" style="border:2px dashed #0F766E;background:transparent"></i>Bán kính ${radiusKm} km</span>
  ${interactivePick ? '<span class="pick-hint">· Nhấp hoặc kéo ghim để chọn vị trí & đồng bộ địa chỉ</span>' : ''}
</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var C=${centerJson}, P=${ptsJson}, R=${radMeters}, Z=${zoom}, PICK=${pickEnabled};
var col={wh:'#0F766E',central:'#7C3AED',ret:'#D97706'};
var map=null, mk=null, circle=null;

function emitPick(lat,lng){
  var safeLat = Math.round(Number(lat)*10000)/10000;
  var safeLng = Math.round(Number(lng)*10000)/10000;
  window.parent.postMessage({type:'mapPick',lat:safeLat,lng:safeLng},'*');
  window.parent.postMessage({type:'fscm:pick-coords',lat:safeLat,lng:safeLng},'*');
}

window.addEventListener('message',function(ev){
  if(ev.data && (ev.data.type==='setPoint'||ev.data.type==='fscm:set-center') && typeof ev.data.lat==='number'){
    var la = ev.data.lat, ln = ev.data.lng;
    if(mk) mk.setLatLng([la, ln]);
    if(circle) circle.setLatLng([la, ln]);
    if(map) map.panTo([la, ln]);
  }
});

function fallback(){
  document.getElementById('m').style.display='none';
  var fb=document.getElementById('fb'); fb.style.display='block';
  var s=fb.querySelector('svg');
  var lats=P.map(function(p){return p.lat;}).concat([C[0]]);
  var lngs=P.map(function(p){return p.lng;}).concat([C[1]]);
  var minLat=Math.min.apply(null,lats)-0.03, maxLat=Math.max.apply(null,lats)+0.03;
  var minLng=Math.min.apply(null,lngs)-0.04, maxLng=Math.max.apply(null,lngs)+0.04;
  function x(lng){return 40+(lng-minLng)/(maxLng-minLng||0.08)*720;}
  function y(lat){return 340-(lat-minLat)/(maxLat-minLat||0.06)*300;}

  var h='<rect width="800" height="380" fill="#EEF4EF"/>';
  for(var i=0;i<800;i+=80) h+='<line x1="'+i+'" y1="0" x2="'+i+'" y2="380" stroke="#DDE5DF"/>';
  for(var j=0;j<380;j+=60) h+='<line x1="0" y1="'+j+'" x2="800" y2="'+j+'" stroke="#DDE5DF"/>';
  if(R>0){
    var rx=(R/111000)/(maxLng-minLng||0.08)*720;
    h+='<circle cx="'+x(C[1])+'" cy="'+y(C[0])+'" r="'+rx+'" fill="#0F766E" fill-opacity="0.08" stroke="#0F766E" stroke-dasharray="6 4"/>';
  }
  P.forEach(function(p){
    var c=col[p.kind]||'#0F766E';
    h+='<circle cx="'+x(p.lng)+'" cy="'+y(p.lat)+'" r="'+(p.kind==='ret'?6:9)+'" fill="'+c+'" stroke="#fff" stroke-width="2"/><text x="'+(x(p.lng)+11)+'" y="'+(y(p.lat)+4)+'" font-size="11" fill="#1E293B" font-weight="600">'+p.label+'</text>';
  });
  if(PICK){
    h+='<circle cx="'+x(C[1])+'" cy="'+y(C[0])+'" r="10" fill="#B42318" stroke="#fff" stroke-width="3"/>';
    h+='<text x="10" y="22" font-size="12" fill="#14655B" font-weight="600">Bấm vào khung bản đồ để chọn tọa độ và đồng bộ địa chỉ kho.</text>';
  }
  s.innerHTML=h;
  if(PICK){
    fb.style.cursor='crosshair';
    fb.addEventListener('click',function(ev){
      var rect=fb.getBoundingClientRect();
      var vx=(ev.clientX-rect.left)/rect.width*800;
      var vy=(ev.clientY-rect.top)/rect.height*380;
      var lng=minLng+(vx-40)/720*(maxLng-minLng||0.08);
      var lat=minLat+(340-vy)/300*(maxLat-minLat||0.06);
      C=[lat,lng];
      emitPick(lat,lng);
      fallback();
    });
  }
}

try{
  if(!window.L) throw 0;
  map=L.map('m').setView(C,Z);
  var tl=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19}).addTo(map);
  tl.on('tileerror',function(){});

  if(R>0){
    circle=L.circle(C,{radius:R,color:'#0F766E',weight:1.5,dashArray:'6 4',fillOpacity:0.07}).addTo(map);
  }

  P.forEach(function(p){
    var c=col[p.kind]||'#0F766E';
    L.circleMarker([p.lat,p.lng],{radius:p.kind==='ret'?7:10,color:'#fff',weight:2,fillColor:c,fillOpacity:0.95})
      .addTo(map).bindPopup('<b>'+p.label+'</b><br/>'+(p.sub||'')+'<br/><small>['+p.lat+', '+p.lng+']</small>');
  });

  if(PICK){
    map.getContainer().style.cursor='crosshair';
    mk=L.marker(C,{draggable:true,title:'Vị trí đang chọn'}).addTo(map);
    mk.bindTooltip('Vị trí kho đang chọn (kéo ghim để đổi)',{permanent:false,direction:'top'});

    mk.on('dragend',function(e){
      var p=e.target.getLatLng();
      if(circle) circle.setLatLng(p);
      emitPick(p.lat, p.lng);
    });

    map.on('click',function(e){
      mk.setLatLng(e.latlng);
      if(circle) circle.setLatLng(e.latlng);
      emitPick(e.latlng.lat, e.latlng.lng);
    });
  }
}catch(e){fallback();}
</script></body></html>`;
}
