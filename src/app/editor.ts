import { mountEditor } from '../presentation/editor/mount-editor';
import { bindPageViewport } from '../presentation/editor/page-viewport';
import { checkSpec, createAgentApi, registerWebMcpTools, specFromLink } from './agent-api';
import { designFromLink, designLink, hasDesign } from './design-link';
import { prepareSession } from './session-bootstrap';
import { connectSessions } from './session-platform';
import { projectToScene } from '../application/projects/editor-mapper';

const root=document.querySelector<HTMLElement>('#editor-root');
if(!root) throw new Error('Editor mount point is missing.');
// AI agents are welcome: a guide and functions on window.wardrobeForge (WebMCP tools where offered). They are
// ready before the editor and stay when it cannot start (agents' browsers often have no WebGL).
let editor:ReturnType<typeof mountEditor>|null=null;
const agents=createAgentApi(()=>editor,location);
Object.defineProperty(window,'wardrobeForge',{value:agents,configurable:true});
registerWebMcpTools(agents,document,navigator);
console.info('Wardrobe Forge: AI agents can design here. Call window.wardrobeForge.help() for the guide, or read /llms.txt.');
async function main(): Promise<void> {
 const url=new URL(location.href);
 const platform=await prepareSession(url);
 let sessions:ReturnType<typeof connectSessions>|undefined;
 const mounted=mountEditor({root:root!,initialScene:projectToScene(platform.draft.document),
  shareLink:scene=>sessions?sessions.share():designLink(scene,location.href.split('#')[0]!)});
 editor=mounted;
 if(platform.warning) mounted.notify(platform.warning);
 const unbindViewport=bindPageViewport(root!,window);
 // A design link opens that design, on loading and when the link changes: #design= is a design someone
 // shared (the whole design), #spec= one an assistant described.
 const openLink=async()=>{
  if(hasDesign(location.hash)) {
   await designFromLink(location.hash).then(project=>{mounted.replaceDesign(project);mounted.notify('This is the shared design. Undo goes back to yours.');},
    ()=>mounted.notify('This design link could not be opened: it is damaged or cut short. Ask for the link again.'));
   return;
  }
  if(!new URLSearchParams(location.hash.slice(1)).has('spec')) return;
  let built:ReturnType<typeof checkSpec>|null=null;
  try { built=checkSpec(specFromLink(location.hash)); } catch { /* not a readable link */ }
  if(built?.project) mounted.replaceDesign(built.project);
  else mounted.notify('This design link could not be opened: '+(built && !built.result.ok ? built.result.problems.map(p=>p.message).join(' ') : 'it is not a design spec.'));
 };
 await openLink();
 sessions=connectSessions(platform,mounted);
 await sessions.ready;
 window.addEventListener('hashchange',openLink);
 const dispose=()=>{window.removeEventListener('hashchange',openLink);sessions?.dispose();unbindViewport();mounted.dispose();editor=null;};
 window.addEventListener('pagehide',event=>{if(!event.persisted)dispose();},{once:true});
 import.meta.hot?.dispose(dispose);
}
void main().catch(error=>{
 editor=null;
 const errorRoot=root.shadowRoot??root;
 errorRoot.replaceChildren();
 const text=error instanceof Error?error.message:'';
 const style=document.createElement('style');
 style.textContent=':host,#editor-root{display:block;box-sizing:border-box;max-width:640px;margin:0 auto;padding:24px 16px;font:16px/1.5 system-ui,sans-serif;color:#2b2a27}h1{font-size:22px;line-height:1.3}a{color:inherit}';
 errorRoot.append(style);
 const say=(tag:string,content:string)=>{const el=document.createElement(tag);el.textContent=content;errorRoot.append(el);return el;};
 if(/webgl/i.test(text)) {
  say('h1','This browser cannot show the 3D editor').role='alert';
  say('p','WebGL is turned off or not available here. Open this page in Chrome, Safari, Edge or Firefox on a phone or computer.');
  say('p','AI assistants: window.wardrobeForge works in this browser. Call help(), check(spec) and link(spec), and give the person the link to open in their own browser. The guide is at /llms.txt.');
  // A design link is still checked, so an assistant reading this page learns whether it builds.
  if(new URLSearchParams(location.hash.slice(1)).has('spec')) {
   let built:ReturnType<typeof checkSpec>|null=null;
   try { built=checkSpec(specFromLink(location.hash)); } catch { /* not a readable link */ }
   say('p',built?.result.ok ? 'This design link builds: '+built.result.report.wardrobes.length+' wardrobe(s). It opens in a browser with 3D.'
    : 'This design link cannot be built: '+(built && !built.result.ok ? built.result.problems.map(p=>p.path+': '+p.message).join(' ') : 'it is not a design spec.'));
  }
 } else say('p',text||'Could not start the editor.').role='alert';
 const back=document.createElement('a');back.href='./editor.html';back.textContent='Open editor';errorRoot.append(back);
 console.error(error);
});
