from __future__ import annotations
import pathlib, re, subprocess, tempfile
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
REACT = pathlib.Path('/opt/pyvenv/lib/python3.13/site-packages/nbclassic/static/components/react/react.production.min.js')
REACT_DOM = pathlib.Path('/opt/pyvenv/lib/python3.13/site-packages/nbclassic/static/components/react-dom/umd/react-dom.production.min.js')
FILES = [
    ROOT / 'src/features/messages/SoaChatScreen.tsx',
    ROOT / 'src/features/paywall/PrototypePaywall.tsx',
    ROOT / 'src/features/story/DialogueBox.tsx',
    ROOT / 'src/features/story/ChoiceList.tsx',
    ROOT / 'src/features/story/StoryScreen.tsx',
]

def clean(source: str) -> str:
    source = re.sub(r'^import[^\n]*\n', '', source, flags=re.M)
    source = source.replace('export function ', 'function ')
    return source

def main() -> int:
    with tempfile.TemporaryDirectory() as td:
        out = pathlib.Path(td)
        dts = out / 'globals.d.ts'
        dts.write_text(
            "declare var React:any; declare var ReactDOM:any;\n"
            "declare namespace JSX { interface IntrinsicElements { [name:string]:any } }\n",
            encoding='utf-8',
        )
        parts = [
            "const useState=(initial:any)=>[initial,()=>{}] as any; const useEffect=(..._args:any[])=>{}; const trackEvent=async(..._args:any[])=>{}; type Scene=any; type Choice=any; type Episode=any; type StoryState=any;\n",
            "function getScene(ep:any,id:string){return ep.scenes.find((s:any)=>s.id===id)}\n",
            "function getAvailableChoices(scene:any,state:any){return (scene.choices||[]).filter((c:any)=>!(c.conditions||[]).some((x:any)=>x.kind==='flagEquals' && state.flags[x.flag]!==x.value));}\n",
        ]
        parts.extend(clean(p.read_text(encoding='utf-8')) for p in FILES)
        parts.append(r'''
const episode={id:'smoke',title:'Номер, который не должен отвечать',startSceneId:'choice',scenes:[{id:'choice',kind:'dialogue',speaker:'Лера',text:'Что ответить?',background:'apartment_hall_night',character:'lera-concerned',choices:[{id:'open',text:'Рассказать правду',nextSceneId:'x'},{id:'locked',text:'Показать улику',nextSceneId:'x',conditions:[{kind:'flagEquals',flag:'has_clue',value:true}]}]}]};
const state={junhoScore:0,taeyunScore:0,truthScore:0,riskScore:0,flags:{}};
(window as any).__calls=0;
function Smoke(){return <StoryScreen episode={episode} sceneId="choice" state={state} onChoose={()=>{(window as any).__calls++; return new Promise(()=>{});}} onAdvance={()=>{}} />}
ReactDOM.render(React.createElement(Smoke),document.getElementById('root'));
''')
        src=out/'smoke.tsx'; src.write_text('\n'.join(parts),encoding='utf-8')
        subprocess.run(['tsc',str(src),str(dts),'--jsx','react','--module','none','--target','ES2020','--skipLibCheck','--outFile',str(out/'app.js')],check=True,cwd=ROOT)
        css=(ROOT/'src/styles/tokens.css').read_text()+"\n"+(ROOT/'src/styles/global.css').read_text()
        html='<!doctype html><html><head><base href="http://lumi.local/"><style>'+css+'</style></head><body><div id="root"></div><script>'+REACT.read_text()+'</script><script>'+REACT_DOM.read_text()+'</script><script>'+(out/'app.js').read_text()+'</script></body></html>'
        with sync_playwright() as p:
            b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
            page=b.new_page(viewport={'width':390,'height':844})
            def serve_asset(route):
                from urllib.parse import urlparse
                path=urlparse(route.request.url).path.lstrip('/')
                file=ROOT/'public'/path
                if file.exists(): route.fulfill(status=200,body=file.read_bytes(),content_type='image/webp')
                else: route.fulfill(status=404,body=b'')
            page.route('http://lumi.local/assets/**', serve_asset)
            page.on('pageerror', lambda err: print('PAGEERROR', err)); page.set_content(html,wait_until='domcontentloaded')
            if page.get_by_text('Что ответить?').count()!=1: raise AssertionError('dialogue missing')
            if page.get_by_role('button',name='Рассказать правду').count()!=1: raise AssertionError('available choice missing')
            if page.get_by_role('button',name='Показать улику').count()!=0: raise AssertionError('locked choice visible')
            shot=ROOT/'.superpowers/sdd/2026-10-02-lumi-prototype-0-1/story-ui-smoke.png'
            page.screenshot(path=str(shot),full_page=True)
            b.close()
        print('PASS: Chromium StoryScreen visual smoke and filtered choices')
    return 0
if __name__=='__main__': raise SystemExit(main())
