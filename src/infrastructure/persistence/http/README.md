# Future backend adapter

Implement `ProjectRepository` here after the API and authentication are defined.
No endpoint or credentials are assumed by the skeleton.

- Map API payloads through validated serialization; keep transport details here.
- Use an atomic expected-revision check on the server and map conflicts to
  `ProjectConflictError`. Authentication and ownership must be checked server-side.
- Enforce document size limits and shape validation server-side.
- Introduce a separate application sync coordinator for ordered autosaves,
  retries, local recovery, and explicit multi-device conflict handling.
- Do not send an old snapshot again with a newer revision to bypass a conflict.

Local IndexedDB persistence is implemented. Remote sync is not.
