# Engineering rules  
  
## General  
- Never change behaviour unless explicitly requested.  
- Prefer minimal, reviewable changes.  
- Never hide errors silently.  
- Avoid unnecessary abstractions.  
- Remove dead code only after verifying it is unused.  
- Do not introduce new dependencies without justification.  
  
## Security  
- Never trust client-side validation.  
- Authorization must be enforced server-side.  
- Never expose secrets.  
- Validate all external input.  
- Use least privilege.  
- Never weaken security to make a test pass.  
  
## Database  
- Preserve data integrity.  
- Schema changes require migrations.  
- Avoid N+1 queries.  
- Transactions must protect multi-step critical operations.  
  
## Quality  
- Prefer explicit code over clever code.  
- Keep functions focused.  
- Avoid duplicated business logic.  
- Use existing conventions unless they are demonstrably problematic.  
  
## Comments  
Comments explain why, not what.  
  
## Tests  
Every bug fix requires a regression test when technically possible.  
  
## Changes  
Before modifying code:  
1. explain the problem;  
2. identify affected files;  
3. propose the minimal solution;  
4. identify regression risks.  
  
After modifying code:  
1. run tests;  
2. run lint/type checking;  
3. review the diff;  
4. report remaining uncertainties.  


## Domain and security invariants

### Authorization
- Authentication is not authorization.
- Every server-side read of sensitive data must check authorization before querying or serializing it.
- Every mutation must authorize the specific resource and operation.
- UI visibility is never considered an authorization control.
- Middleware is never the sole authorization control.

### Business rules
- There must be one canonical implementation of each business rule.
- Indirect mutations must enforce the same permissions and invariants as direct mutations.
- Do not duplicate domain logic between pages, actions, imports, proposals or exports.

### Generic field editing
- Do not add critical business fields to saveField.
- Statuses, permissions, financial values, payments, validation states and relationships require dedicated commands.

### Data integrity
- Multi-step business mutations must define their transactional boundary.
- Never rely only on application code when a stable database constraint can safely enforce an invariant.
- Destructive cascades involving historical or financial data require explicit review.

### Tests
Every security or business bug must receive a regression test.

Every new critical business feature must include:
- permission tests
- negative tests
- integration tests against PostgreSQL where relevant

### Scope
Do not refactor unrelated code while implementing a feature.