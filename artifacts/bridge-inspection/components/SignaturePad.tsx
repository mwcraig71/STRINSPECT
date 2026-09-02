import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { AppIcon as Feather } from "@/components/AppIcon";
import { WebView } from "react-native-webview";

const SIG_HTML = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=0">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
html,body{height:100%;overflow:hidden;background:#fff;}
#wrap{display:flex;flex-direction:column;height:100%;}
#canvas-area{flex:1;position:relative;}
canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none;background:#fff;cursor:crosshair;display:block;}
#guide{position:absolute;bottom:28px;left:16px;right:16px;height:1px;background:#e2e8f0;pointer-events:none;}
#hint{position:absolute;bottom:10px;left:0;right:0;font-family:sans-serif;font-size:11px;color:#94a3b8;text-align:center;pointer-events:none;}
#btns{display:flex;gap:10px;padding:10px 14px;background:#f8fafc;border-top:1px solid #e2e8f0;flex-shrink:0;}
button{flex:1;padding:12px;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;}
#clear{background:#fee2e2;color:#dc2626;}
#save{background:#166534;color:#fff;}
</style>
</head>
<body>
<div id="wrap">
<div id="canvas-area">
<canvas id="c"></canvas>
<div id="guide"></div>
<div id="hint">Sign above the line</div>
</div>
<div id="btns">
<button id="clear">Clear</button>
<button id="save">Accept Signature</button>
</div>
</div>
<script>
var c=document.getElementById('c');
var ctx=c.getContext('2d');
var drawing=false;
var empty=true;
function resize(){
  var area=document.getElementById('canvas-area');
  var w=area.offsetWidth;var h=area.offsetHeight;
  var dpr=window.devicePixelRatio||1;
  c.width=w*dpr;c.height=h*dpr;
  ctx.scale(dpr,dpr);
  ctx.strokeStyle='#1e293b';ctx.lineWidth=2.2;ctx.lineCap='round';ctx.lineJoin='round';
}
resize();
window.addEventListener('resize',function(){resize();});
function pos(e){var r=c.getBoundingClientRect();var s=e.touches?e.touches[0]:e;return{x:(s.clientX-r.left),y:(s.clientY-r.top)};}
c.addEventListener('mousedown',function(e){drawing=true;empty=false;var p=pos(e);ctx.beginPath();ctx.moveTo(p.x,p.y);});
c.addEventListener('mousemove',function(e){if(!drawing)return;var p=pos(e);ctx.lineTo(p.x,p.y);ctx.stroke();});
c.addEventListener('mouseup',function(){drawing=false;});
c.addEventListener('mouseleave',function(){drawing=false;});
c.addEventListener('touchstart',function(e){e.preventDefault();drawing=true;empty=false;var p=pos(e);ctx.beginPath();ctx.moveTo(p.x,p.y);},{passive:false});
c.addEventListener('touchmove',function(e){e.preventDefault();if(!drawing)return;var p=pos(e);ctx.lineTo(p.x,p.y);ctx.stroke();},{passive:false});
c.addEventListener('touchend',function(){drawing=false;});
document.getElementById('clear').onclick=function(){ctx.clearRect(0,0,c.width,c.height);empty=true;postMsg({type:'cleared'});};
document.getElementById('save').onclick=function(){
  if(empty){postMsg({type:'empty'});return;}
  postMsg({type:'signature',data:c.toDataURL('image/png')});
};
function postMsg(msg){
  var s=JSON.stringify(msg);
  if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(s);}
  else if(window.parent&&window.parent!==window){window.parent.postMessage(s,'*');}
}
</script>
</body>
</html>`;

interface Props {
  visible: boolean;
  crewName?: string;
  onSave: (dataUrl: string) => void;
  onClose: () => void;
}

export function SignaturePad({ visible, crewName, onSave, onClose }: Props) {
  const webViewRef = useRef<WebView>(null);
  const iframeRef = useRef<any>(null);
  const [sessionKey, setSessionKey] = useState(0);

  useEffect(() => {
    if (visible) setSessionKey((k) => k + 1);
  }, [visible]);

  const handleMsg = useCallback(
    (raw: string) => {
      try {
        const msg = JSON.parse(raw) as { type: string; data?: string };
        if (msg.type === "signature" && msg.data) {
          onSave(msg.data);
        } else if (msg.type === "empty") {
          Alert.alert("Signature Empty", "Please draw your signature before accepting.");
        }
      } catch {}
    },
    [onSave],
  );

  useEffect(() => {
    if (Platform.OS !== "web" || !visible) return;
    const handler = (e: MessageEvent) => {
      if (typeof e.data === "string") handleMsg(e.data);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [visible, handleMsg]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Feather name="edit-2" size={18} color="#1e293b" />
            <Text style={styles.headerTitle}>
              {crewName ? `Sign — ${crewName}` : "Draw Signature"}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Feather name="x" size={20} color="#64748b" />
          </TouchableOpacity>
        </View>

        {Platform.OS === "web"
          ? React.createElement("iframe", {
              key: sessionKey,
              ref: iframeRef,
              srcDoc: SIG_HTML,
              style: { flex: 1, border: "none", width: "100%", display: "block" },
            })
          : (
            <WebView
              key={sessionKey}
              ref={webViewRef}
              source={{ html: SIG_HTML }}
              style={styles.webview}
              javaScriptEnabled
              originWhitelist={["*"]}
              scrollEnabled={false}
              onMessage={(e) => handleMsg(e.nativeEvent.data)}
            />
          )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 15, fontWeight: "800", color: "#1e293b" },
  closeBtn: { padding: 6 },
  webview: { flex: 1 },
});
