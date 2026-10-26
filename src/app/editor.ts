import { preloadOakTextures } from '../presentation/viewport/wood-textures';
import type { mountEditor } from '../presentation/editor/mount-editor';
import { checkSpec, createAgentApi, registerWebMcpTools, specFromLink } from './agent-api';
import { designFromLink, hasDesign } from './design-link';
import { prepareSession } from './session-bootstrap';
import { createDesignWorkspace } from './design-workspace';
import { takeCheckoutReturn } from './credit-platform';
import { createLoadingPlaceholder } from '../presentation/components/loading-state';
import '../presentation/components/loading-state.css';

const root=document.querySelector<HTMLElement>('#editor-root');
if(!root) throw new Error('Editor mount point is missing.');
const startup = document.querySelector<HTMLElement>('#workspace-loading') ?? document.createElement('div');
startup.className = 'ui-loading-startup';
startup.replaceChildren(createLoadingPlaceholder(document, 'Opening your workspace…', 'canvas'));
const startupCopy = document.createElement('p'); startupCopy.textContent = 'Opening your workspace…'; startup.append(startupCopy);
document.body.append(startup);
// AI agents are welcome: a guide and functions on window.furnidraw (WebMCP tools where offered). They are
// ready before the editor and stay when it cannot start (agents' browsers often have no WebGL).
let editor:ReturnType<typeof mountEditor>|null=null;
const agents=createAgentApi(()=>editor,location);
Object.defineProperty(window,'furnidraw',{value:agents,configurable:true});
// The app's earlier name, kept so agents and links written for it still work.
Object.defineProperty(window,'wardrobeForge',{value:agents,configurable:true});
registerWebMcpTools(agents,document,navigator);
console.info('FurniDraw: AI agents can design here. Call window.furnidraw.help() for the guide, or read /llms.txt.');
async function main(): Promise<void> {
 const checkout=takeCheckoutReturn(new URL(location.href),history);
 const url=new URL(location.href);
 preloadOakTextures(document);
 const platform=await prepareSession(url);
 // A design link opens that design, on loading and when the link changes: #design= is a design someone
 // shared (the whole design), #spec= one an assistant described.
 const openLink=async()=>{
  if(hasDesign(location.hash)) {
   await designFromLink(location.hash).then(project=>{editor?.replaceDesign(project);editor?.notify('This is the shared design. Undo goes back to yours.');},
    ()=>editor?.notify('This design link could not be opened: it is damaged or cut short. Ask for the link again.'));
   return;
  }
  if(!new URLSearchParams(location.hash.slice(1)).has('spec')) return;
  let built:ReturnType<typeof checkSpec>|null=null;
  try { built=checkSpec(specFromLink(location.hash)); } catch { /* not a readable link */ }
  if(built?.project) editor?.replaceDesign(built.project);
  else editor?.notify('This design link could not be opened: '+(built && !built.result.ok ? built.result.problems.map(p=>p.message).join(' ') : 'it is not a design spec.'));
 };
 const workspace=createDesignWorkspace({root:root!,platform,changed:value=>{editor=value;},initialLink:openLink,checkout});
 startup.remove();
 await workspace.start();
 window.addEventListener('hashchange',openLink);
 const dispose=()=>{window.removeEventListener('hashchange',openLink);workspace.dispose();};
 window.addEventListener('pagehide',event=>{if(!event.persisted)dispose();},{once:true});
 import.meta.hot?.dispose(dispose);
}
void main().finally(() => startup.remove()).catch(error=>{
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
  say('p','AI assistants: window.furnidraw works in this browser. Call help(), check(spec) and link(spec), and give the person the link to open in their own browser. The guide is at /llms.txt.');
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
