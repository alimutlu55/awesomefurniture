// Direct production tests can supply a minimal DOM scope without mounting markup.
exports.domFixture=()=>({
 $:selector=>global.document?.querySelector(selector),document:new Proxy({}, {get(_target,key){const value=global.document?.[key];return typeof value==='function'?value.bind(global.document):value}}),
 window:global.window,matchMedia:query=>global.matchMedia?.(query),selector:value=>value,setId:(element,id)=>element.id=id,controlId:element=>element.id,
 get width(){return global.innerWidth??1200},get height(){return global.innerHeight??800},dispose(){}
});
