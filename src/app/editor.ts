import { mountEditor } from '../presentation/editor/mount-editor';
import { bindPageViewport } from '../presentation/editor/page-viewport';
import { checkSpec, createAgentApi, fromBase64Url, registerWebMcpTools } from './agent-api';

const root=document.querySelector<HTMLElement>('#editor-root');
if(!root) throw new Error('Editor mount point is missing.');
async function main(): Promise<void> {
 const url=new URL(location.href);
 if(url.searchParams.has('project')) {
  url.searchParams.delete('project');
  history.replaceState(null,'',url);
 }
 const editor=mountEditor({root:root!});
 const unbindViewport=bindPageViewport(root!,window);
 // AI agents are welcome: a guide and functions on window.wardrobeForge (WebMCP tools where offered).
 const agents=createAgentApi(editor,location);
 Object.defineProperty(window,'wardrobeForge',{value:agents,configurable:true});
 registerWebMcpTools(agents,document,navigator);
 console.info('Wardrobe Forge: AI agents can design here. Call window.wardrobeForge.help() for the guide, or read /llms.txt.');
 // A design link (#spec=, base64url JSON) opens that design, on loading and when the link changes.
 const openLink=()=>{
  const spec=new URLSearchParams(location.hash.slice(1)).get('spec');
  if(!spec) return;
  let built:ReturnType<typeof checkSpec>|null=null;
  try { built=checkSpec(JSON.parse(fromBase64Url(spec))); } catch { /* not a readable link */ }
  if(built?.project) editor.replaceDesign(built.project);
  else editor.notify('This design link could not be opened: '+(built && !built.result.ok ? built.result.problems.map(p=>p.message).join(' ') : 'it is not a design spec.'));
 };
 openLink();
 window.addEventListener('hashchange',openLink);
 const dispose=()=>{window.removeEventListener('hashchange',openLink);unbindViewport();editor.dispose();};
 window.addEventListener('pagehide',event=>{if(!event.persisted)dispose();},{once:true});
 import.meta.hot?.dispose(dispose);
}
void main().catch(error=>{
 const errorRoot=root.shadowRoot??root;
 errorRoot.replaceChildren();
 const message=document.createElement('p');message.role='alert';message.textContent=error instanceof Error?error.message:'Could not start the editor.';
 const back=document.createElement('a');back.href='./editor.html';back.textContent='Open editor';errorRoot.append(message,back);
 console.error(error);
});
