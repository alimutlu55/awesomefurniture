import { mountEditor } from '../presentation/editor/mount-editor';

const root=document.querySelector<HTMLElement>('#editor-root');
if(!root) throw new Error('Editor mount point is missing.');
async function main(): Promise<void> {
 const url=new URL(location.href);
 if(url.searchParams.has('project')) {
  url.searchParams.delete('project');
  history.replaceState(null,'',url);
 }
 const editor=mountEditor({root:root!});
 const dispose=()=>editor.dispose();
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
