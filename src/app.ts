//const DATAURL = "http://192.168.1.223/wifimanager";
const DATAURL = "wifimanager";

const gel = (e:string) => document.getElementById(e)!;
class $
{
    public static readonly SVGNS = "http://www.w3.org/2000/svg";
    public static readonly XLINKNS = "http://www.w3.org/1999/xlink";
    public static readonly HTMLNS = "http://www.w3.org/1999/xhtml";

    public static Svg(parent: Element, type:string,  attributes:string[], classes?: string[]):SVGElement {
        return  parent.appendChild(<SVGElement>$.Elem($.SVGNS, type, attributes, classes));
    }

    public static Html(parent: Element, type:string, attributes?:string[], classes?: string[], textContent?:string):HTMLElement {
        return parent.appendChild(<HTMLElement>$.Elem($.HTMLNS, type, attributes, classes, textContent));
    }

    public static HtmlAsFirstChild(parent: Element, type:string,  attributes?:string[], classes?: string[], textContent?:string):HTMLElement {
        if(parent.firstChild)
            return parent.insertBefore(<HTMLElement>$.Elem($.HTMLNS, type, attributes, classes, textContent), parent.firstChild);
        else
            return parent.appendChild(<HTMLElement>$.Elem($.HTMLNS, type, attributes, classes, textContent));
    }

    private static Elem(ns:string, type:string, attributes?:string[], classes?: string[], textContent?:string):Element
    {
        let element = document.createElementNS(ns, type);
        if(classes)
        {
            for (const clazz of classes) {
                element.classList.add(clazz);
            }
        }
        let i:number;
        if(attributes){
            for(i=0;i<attributes.length;i+=2)
            {
                element.setAttribute(attributes[i], attributes[i+1]);
            }
        }
        if(textContent)
        {
            element.textContent=textContent;
        }
        return element;
    }
}

enum ConnType{
  MANUAL,
  LIST,
}

const UNIT_SEPARATOR = '\x1F';
const RECORD_SEPARATOR = '\x1E';
const GROUP_SEPARATOR = '\x1D';
const FILE_SEPARATOR = '\x1C';


class AccessPoint{
  constructor(public ssid:string, public primaryChannel:number, public rssi:number, public authMode:number){}

  public static ParseFromString(str:string):AccessPoint {
    let items = str.split(UNIT_SEPARATOR);
    return new AccessPoint(items[0], parseInt(items[1]), parseInt(items[2]), parseInt(items[3]));
  }
}

class AppController {

    private wifi_div = gel("wifi") as HTMLDivElement;
    private connect_div = gel("connect")  as HTMLDivElement;
    private connect_manual_div = gel("connect_manual") as HTMLDivElement;
    private connect_wait_div = gel("connect-wait") as HTMLDivElement;
    private connect_details_div = gel("connect-details") as HTMLDivElement;
    private connect_success = gel("connect-success") as HTMLDivElement;
    private connect_fail = gel("connect-fail") as HTMLDivElement;
    private diag_disconnect = gel("diag-disconnect");
    private connect_details_wrap = (gel("connect-details-wrap") as HTMLDivElement);
    private selectedSSID = "";
    private refreshDataInterval:any=null;

    constructor() {}

    private cancel() {
      this.selectedSSID = "";
      this.connect_div.style.display = "none";
      this.connect_manual_div.style.display = "none";
      this.wifi_div.style.display = "block";
    }
  
    private stopRefreshDataInterval() {
      if (this.refreshDataInterval != null) {
        clearInterval(this.refreshDataInterval);
        this.refreshDataInterval = null;
      }
    }
    
    private startRefreshDataInterval() {
      this.refreshDataInterval = setInterval(()=>{this.refreshData();}, 4000);
    }

    public startup() {
        gel("wifi-status").addEventListener(
            "click",
            () => {
              this.wifi_div.style.display = "none";
              this.connect_details_div.style.display = "block";
            },
            false
          );
        
          gel("manual_add").addEventListener(
            "click",
            (e) => {
              this.wifi_div.style.display = "none";
              this.connect_manual_div.style.display = "block";
              this.connect_div.style.display = "none";
              this.connect_success.style.display = "none";
              this.connect_fail.style.display = "none";
            },
            false
          );
        
          gel("cancel").addEventListener("click",()=>{this.cancel();}, false);

          gel("manual_cancel").addEventListener("click", ()=>{this.cancel();}, false);
        
          gel("join").addEventListener("click", ()=>{this.performConnect(ConnType.LIST);}, false);
        
          gel("manual_join").addEventListener(
            "click",
            (e) => {
              this.performConnect(ConnType.MANUAL);
            },
            false
          );
        
          gel("ok-details").addEventListener(
            "click",
            () => {
              this.connect_details_div.style.display = "none";
              this.wifi_div.style.display = "block";
            },
            false
          );
        
          gel("ok-credits").addEventListener(
            "click",
            () => {
              (gel("credits") as HTMLDivElement).style.display = "none";
              (gel("app") as HTMLDivElement).style.display = "block";
            },
            false
          );
        
          gel("acredits").addEventListener(
            "click",
            (e) => {
              e.preventDefault();
              (gel("app") as HTMLDivElement).style.display = "none";
              (gel("credits") as HTMLDivElement).style.display = "block";
            },
            false
          );
        
          gel("ok-connect").addEventListener(
            "click",
            () => {
              this.connect_wait_div.style.display = "none";
              this.wifi_div.style.display = "block";
            },
            false
          );
        
          gel("disconnect").addEventListener(
            "click",
            () => {
              this.diag_disconnect.style.display = "block";
              this.connect_details_wrap.classList.add("blur");
            },
            false
          );
        
          gel("no-disconnect").addEventListener(
            "click",
            () => {
              this.diag_disconnect.style.display = "none";
              this.connect_details_wrap.classList.remove("blur");
            },
            false
          );
        
          gel("yes-disconnect").addEventListener("click", () => {
            this.stopRefreshDataInterval();
            this.selectedSSID = "";
        
            this.diag_disconnect.style.display = "none";
            this.connect_details_wrap.classList.remove("blur");
        
            fetch(DATAURL, {
              method: "DELETE",
            }).then(()=>{
              this.startRefreshDataInterval();
              this.connect_details_div.style.display = "none";
              this.wifi_div.style.display = "block";
            });
          });

          this.refreshData();
          this.startRefreshDataInterval();
    }

    private performConnect(conntype:ConnType) {
      //stop the status refresh. This prevents a race condition where a status
      //request would be refreshed with wrong ip info from a previous connection
      //and the request would automatically shows as succesful.
      this.stopRefreshDataInterval();
      let pwd:string="";
      if (conntype == ConnType.MANUAL) {
        //Grab the manual SSID and PWD
        this.selectedSSID = (gel("manual_ssid") as HTMLInputElement).value;
        pwd = (gel("manual_pwd") as HTMLInputElement).value;
      } else {
        pwd = (gel("pwd") as HTMLInputElement).value;
      }
      //reset connection
      (gel("loading") as HTMLDivElement).style.display = "block";
      this.connect_success.style.display = "none";
      this.connect_fail.style.display = "none";
    
      (gel("ok-connect") as HTMLInputElement).disabled = true;
      (gel("ssid-wait") as HTMLSpanElement).textContent = this.selectedSSID;
      this.connect_div.style.display = "none";
      this.connect_manual_div.style.display = "none";
      this.connect_wait_div.style.display = "block";
      let content=`${this.selectedSSID}`+UNIT_SEPARATOR+`${pwd}`+UNIT_SEPARATOR+RECORD_SEPARATOR;
      console.log("Sending connect request with "+content)
      fetch(DATAURL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
        },
        body: content,
      });
      //now we can re-set the intervals regardless of result
      this.startRefreshDataInterval();
    }

    public processStatusString(statusString:string){
      let items = statusString.split(UNIT_SEPARATOR);
      let ssid = items[0];
      let ip=items[1];
      let netmask=items[2];
      let gw=items[3];
      let urc=parseInt(items[4]);
      if(ssid==""){
        if(urc==2){
          console.log("Manual disconnect requested...");
          (gel("wifi-status") as HTMLDivElement).style.display = "none";
        }
      }else if(ssid==this.selectedSSID){
        (gel("connected-to-span") as HTMLSpanElement).textContent = ssid;
        (gel("connect-details-h1") as HTMLHeadElement).textContent = ssid;
        if(urc==0){
          console.info("Got connection!");

          (gel("ip") as HTMLDivElement).textContent = ip;
          (gel("netmask") as HTMLDivElement).textContent = netmask;
          (gel("gw") as HTMLDivElement).textContent = gw;
          (gel("wifi-status") as HTMLDivElement).style.display = "block";

          //unlock the wait screen if needed
          (gel("ok-connect")as HTMLInputElement).disabled = false;

          //update wait screen
          (gel("loading") as HTMLDivElement).style.display = "none";
          this.connect_success.style.display = "block";
          this.connect_fail.style.display = "none";
        }
        else{
          console.info("Connection attempt failed!");

          (gel("ip") as HTMLDivElement).textContent = "0.0.0.0";
          (gel("netmask") as HTMLDivElement).textContent = "0.0.0.0";
          (gel("gw") as HTMLDivElement).textContent = "0.0.0.0";

          //don't show any connection
          (gel("wifi-status") as HTMLDivElement).style.display = "none";

          //unlock the wait screen
          (gel("ok-connect") as HTMLInputElement).disabled = false;

          //update wait screen
          (gel("loading") as HTMLDivElement).style.display = "none";
          this.connect_success.style.display = "none";
          this.connect_fail.style.display = "block";
        }
      }else{//ssid!="" && ssid!=this.selectedSSID
        (gel("connected-to-span") as HTMLSpanElement).textContent = ssid;
        (gel("connect-details-h1") as HTMLElement).textContent = ssid;
        (gel("ip") as HTMLDivElement).textContent = ip;
        (gel("netmask") as HTMLDivElement).textContent = netmask;
        (gel("gw") as HTMLDivElement).textContent = gw;
        (gel("wifi-status") as HTMLDivElement).style.display = "block";
      }
    }


    public processAccessPointsStrings(apStrings:string[]){

      let access_points = new Map<string, AccessPoint>();
      for (const str of apStrings) {
        //make unique
        let ap_new:AccessPoint = AccessPoint.ParseFromString(str);
        let key = ap_new.ssid+"_"+ap_new.authMode;
        let ap_exist = access_points.get(key);
        if(ap_exist===undefined){
          access_points.set(key, ap_new);
        }
        else{
          ap_exist.rssi=Math.max(ap_exist.rssi, ap_new.rssi);
        }
      }
      let access_points_list = [...access_points.values()];
      access_points_list.sort((a, b) => {
        //sort according to rssi
        var x = a.rssi;
        var y = b.rssi;
        return x < y ? 1 : x > y ? -1 : 0;
      });
      let wifiList = gel("wifi-list") as HTMLElement;
      wifiList.textContent="";
      const icon_lock_template = document.getElementById("icon-lock") as HTMLTemplateElement;
      const icon_rssi_template = document.getElementById("icon-wifi") as HTMLTemplateElement;
      let table = $.Html(wifiList, "table");
      access_points_list.forEach((e, idx, array)=>{
        let tr= $.Html(table, "tr");
        let td_rssi = $.Html(tr, "td");
        let figure_rssi= document.importNode(icon_rssi_template.content, true);
        td_rssi.appendChild(figure_rssi);
        let td_auth = $.Html(tr, "td");
        if(e.authMode!= 0){
          td_auth.appendChild(document.importNode(icon_lock_template.content, true));
        }
        let rssiIcon= td_rssi.children[0].children[0];
        (rssiIcon.children[0] as SVGPathElement).style.fill= e.rssi>=-60?"black":"grey";
        (rssiIcon.children[1] as SVGPathElement).style.fill= e.rssi>=-67?"black":"grey";
        (rssiIcon.children[2] as SVGPathElement).style.fill= e.rssi>=-75?"black":"grey";
        $.Html(tr, "td", [], [], `${e.ssid} [${e.rssi}dB]`);
        tr.onclick=()=>{
          this.selectedSSID=e.ssid;
          (gel("ssid-pwd") as HTMLSpanElement).textContent = e.ssid;
          this.connect_div.style.display = "block";
          this.wifi_div.style.display = "none";
        };
      }); 
    }


    private refreshData(){
      fetch(DATAURL,{
        method:"POST",
        headers: {
          "Content-Type": "text/plain",
        },
        body: "",

      })
      .then((response)=>response.text()
      )
      .then((txt)=>{
        let items = txt.split(RECORD_SEPARATOR).filter(r => r !== "");
        this.processStatusString(items[0]);
        this.processAccessPointsStrings(items.slice(1));
      }
      )
      .catch((e)=>console.log(e));
    }
}

let app: AppController;
document.addEventListener("DOMContentLoaded", (e) => {
    app = new AppController();
    app.startup();
});


