# Sooth Protocol Requirements

This folder contains requirement documents for future phases and architectural improvements.

## 📋 Active Requirements

### [MULTI_VAULT_ARCHITECTURE.md](./MULTI_VAULT_ARCHITECTURE.md)

**Status**: Planned for Next Phase  
**Priority**: High  
**Summary**: Implement multi-vault architecture where each adjudicator class has its own dedicated vault for risk isolation.

**Current State**: Single vault serving all markets  
**Target State**: One vault per adjudicator class (UMA, ZK, Attestation, etc.)

**Key Benefits**:

- Risk isolation between different adjudication mechanisms
- LP choice in which market types to support
- Better regulatory compliance

---

## 📁 Requirement Categories

### Architecture & Design

- [x] MULTI_VAULT_ARCHITECTURE.md - Multi-vault system design

### Security & Risk

- [ ] _Future requirements to be added_

### Scalability

- [ ] _Future requirements to be added_

### User Experience

- [ ] _Future requirements to be added_

---

## 🔄 Requirement Lifecycle

```
📝 Draft → 📋 Planned → 🚧 In Progress → ✅ Completed → 📦 Deployed
```

### Status Definitions

| Status          | Emoji | Description                            |
| --------------- | ----- | -------------------------------------- |
| **Draft**       | 📝    | Initial idea, needs refinement         |
| **Planned**     | 📋    | Approved for future phase, not started |
| **In Progress** | 🚧    | Active development                     |
| **Completed**   | ✅    | Implemented and tested                 |
| **Deployed**    | 📦    | Live on mainnet/testnet                |

---

## 📝 Creating New Requirements

When adding a new requirement document, include:

1. **Status**: Current lifecycle stage
2. **Current Implementation**: What exists today
3. **Intended Design**: What should exist
4. **Requirements**: Specific tasks and changes needed
5. **Technical Specifications**: Code examples and architecture
6. **Implementation Checklist**: Actionable items
7. **Timeline Estimate**: Expected duration
8. **Open Questions**: Unresolved design decisions
9. **References**: Related contracts and documentation

### Template

```markdown
# [Requirement Name]

## Status: [Draft/Planned/In Progress/Completed/Deployed]

---

## Current Implementation

[Describe current state]

## Intended Design

[Describe target state]

## Requirements

[List specific requirements]

## Technical Specifications

[Code examples and architecture]

## Implementation Checklist

- [ ] Task 1
- [ ] Task 2

## Timeline Estimate

[Duration estimate]

## Open Questions

1. Question 1?
2. Question 2?

## References

- Contract: `path/to/contract.sol`
- Related docs: `path/to/doc.md`
```

---

## 🎯 Prioritization

Requirements are prioritized based on:

1. **Security Impact**: Does it affect system security?
2. **User Value**: How much does it improve user experience?
3. **Technical Debt**: Does it resolve architectural gaps?
4. **Dependencies**: Is it blocking other features?
5. **Effort**: How complex is the implementation?

---

## 📊 Current Phase Overview

### Phase 1 (Current - Alpha/Testing)

- ✅ Core contracts deployed
- ✅ Single vault architecture
- ✅ Two test markets on Base Sepolia
- ✅ Frontend integration documentation

### Phase 2 (Planned)

- 📋 Multi-vault architecture (MULTI_VAULT_ARCHITECTURE.md)
- 📋 Additional adjudicator integrations
- 📋 Enhanced risk management
- 📋 LP migration tools

### Phase 3 (Future)

- 📝 Mainnet deployment
- 📝 Advanced market types
- 📝 Cross-chain support
- 📝 Governance mechanisms

---

## 🔗 Related Documentation

- **Frontend Integration**: `../frontend-integration/`
- **Contract Interfaces**: `../frontend-integration/CONTRACT_INTERFACES.md`
- **Deployment Info**: `../../deployments.json`
- **Architecture Diagrams**: _To be added_

---

## 📮 Contributing Requirements

To propose a new requirement:

1. Create a new `.md` file in this folder
2. Follow the template structure
3. Set status to "Draft"
4. Submit for review
5. Update this README with the new requirement

---

## 📅 Last Updated

- **Date**: 2025-11-29
- **Phase**: Phase 1 (Alpha/Testing)
- **Active Requirements**: 1
