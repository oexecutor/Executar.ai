# Review Prompt

Review the implementation against this handoff as a separate senior engineer.

Check:

1. Did the implementation preserve current MCP/OAuth/vault routes?
2. Is business logic independent of MCP and HTTP?
3. Is there one canonical source of truth?
4. Are repository writes versioned, idempotent and audited?
5. Does decomposition require proposal and explicit approval?
6. Can UI and MCP observe each other's writes?
7. Are existing vault notes preserved?
8. Are secrets absent from code/client/logs?
9. Are keyboard, reduced-motion and mobile constraints satisfied?
10. Do tests cover the acceptance matrix?
11. Was only a Deploy Preview created?
12. Is rollback documented?

Output:

- PASS;
- PARTIAL;
- FAIL;
- evidence by file/test;
- blocking defects;
- required corrections before production.
