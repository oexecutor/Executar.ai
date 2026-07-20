# Deploy Gates

## Local gate

- source inventory complete;
- build passes;
- current smoke tests pass;
- no secret in repository.

## Commit gate

- focused commits;
- migration documented;
- tests updated;
- docs updated.

## Preview gate

- all automated checks pass;
- preview uses isolated data/secrets;
- OAuth and MCP validated;
- web and MCP consistency validated;
- accessibility smoke passes;
- rollback prepared.

## Production approval gate

Required explicit statement from Leonardo authorizing production deployment.

Approval must identify:

- commit or release;
- preview reviewed;
- migration scope;
- backup created;
- known remaining gaps.

Without this, production deployment is prohibited.
