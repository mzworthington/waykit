# Changelog

## 2026-09-06

### 🚀 Features

- Add dead-code pruning procedure and enhance complexity hotspot tracking in SOPs

### 🐛 Bug Fixes

- *(sops)* Stop PostHog intake when MCP tools are missing (MZW-66) (#66)

### 🧰 Maintenance & Dependencies

- *(deps)* Bump mermaid from 11.16.1 to 11.17.2 (#81)
- *(deps-dev)* Bump tsx from 4.23.12 to 4.23.13 (#80)
- *(deps-dev)* Bump @testing-library/react from 16.3.2 to 16.3.3 (#79)
- *(deps)* Bump actions/deploy-pages from 4 to 5 (#73)
- *(deps)* Bump actions/upload-pages-artifact from 3 to 5 (#72)
- *(deps)* Bump actions/configure-pages from 5 to 6 (#71)
- *(deps-dev)* Bump vitest from 4.1.10 to 4.1.11 (#76)

## 2026-09-05

### 🚀 Features

- Improved CLI UX
- *(ci)* Add 'Repo doctor' step to CI workflow and enhance documentation for first-party adopters
- Enhance accessibility and UI components across the application
- Compelxity skills
- Update coding philosophy and complexity SOPs to enforce capability folder

## 2026-09-04

### 🚀 Features

- Add fleet align, wk version, and role skill line budget
- Wire Linear ticket workflow into commit and SOP routing
- Prefer uncommitted work on main for ticket execution
- Land fleet align, wk version, and role skill line budget
- Enhance pre-commit hook with context measurement and update contributing guidelines
- *(cli)* Emit stable JSON findings for align, doctor, and check (MZW-26)
- *(skills)* Treat filtered tests as a pre-commit failure
- *(mcp)* Restore the previous project profile after a session (MZW-28)
- *(align)* Compose kit default MCP when asked (MZW-23)
- *(subagents)* Add support for host subagent stubs and update related documentation
- *(subagents)* Introduce skills-only mode and update related documentation
- *(subagents)* Status, launch-prompt, and honest eval adapter
- *(evals)* Compare specialist vs skill-picker miss rates (MZW-73)
- *(cli)* Print ok/warn/fail on report commands
- *(cli)* Enhance report command output with color support and ANSI stripping

### 🐛 Bug Fixes

- *(evals)* Reject self-forbidden skill-trigger prompts before CI
- *(debug-ci)* Classify nested pnpm NO_PKG_MANIFEST as config-drift

### ⚙️ Refactoring & Performance

- Update AGENTS.md and evals to enhance clarity and structure

### 📚 Documentation

- Enhance documentation for consumer CI and reusable workflows
- Clarify Windsurf's status as rules-only and update related documentation
- Update SKILL.md to clarify trunk-based pipeline requirements and GitHub PR behavior
- *(handshake)* Point operators at host-subagent launch (MZW-57)
- *(sops)* Treat wrap-up as confirming recommended intake rows (MZW-66)

### 🧪 Testing

- *(edd)* Route failed Actions jobs to debug SOP
- *(evals)* Fail PostHog intake until skill pointers exist (MZW-62)

## 2026-09-03

### 🚀 Features

- Enhance AGENTS.md and SOPs/conventional-commits.md with updated guidelines on commit types and PR titles; add model routing references in various documents
- Implement commit-msg hook for conventional commit validation
- Cli documentation
- Add zsh and bash tab-completion support to CLI
- Add installation of live shell completions for zsh and bash
- Enhance documentation for consumer align and add related commands to CLI help
- Add 'Used on our own product repos' section to documentation
- Add agent-user-stories skill and related evaluations to enhance user story management
- Add new evaluations for operator user stories
- Introduce hypothesis-driven development SOP
- Add PostHog MCP support for analytics and flags
- Enhance PostHog integration

### 🐛 Bug Fixes

- Update agent-user-stories documentation

### ⚙️ Refactoring & Performance

- Update documentation for hypothesis-driven development and lifecycle

### 🧰 Maintenance & Dependencies

- Update documentation and configuration for EDD

## 2026-09-02

### 🚀 Features

- Improve seo
- Convert react to astro to build up and prove out new skills and mcps (#52)
- Add static site build step and enhance documentation structure
- Implement provider error handling and progress tracking in EDD evaluation
- *(edd)* Add http/cli/heuristic judge completion backends (#53)

### 🐛 Bug Fixes

- *(edd)* Update CLI and evaluation run configurations
- *(TodayJobs)* Update button text and aria attributes for better accessibility and functionality

### ⚙️ Refactoring & Performance

- Update theme colors and improve layout styles across components
- *(edd)* Unify evaluation styles and enhance CLI integration
- *(edd)* Streamline agent driver logic and improve evaluation style handling
- Rename Agent Lifecycle Kit to Waykit across all files for consistency and clarity

### 🧰 Maintenance & Dependencies

- Update site URLs and improve SEO metadata

### 📚 Documentation

- Enhance kit map authoring guide and update related documentation
- *(edd)* Update README and SOPs to clarify live goldens and CI seed usage
- Clarify installation process and update terminology for skill-trigger evaluations
- Update references from Agent Lifecycle Kit to Waykit, enhancing clarity and consistency across documentation
- Update AGENTS.md and SOPs/release.md for clarity on stack rules and release procedures; add new evaluation case for CI/CD pipeline

## 2026-09-01

### 🚀 Features

- *(evals)* Cover missing skills and kit-knowledge get_handover (#31)
- Cleanup index.html
- Add analytics
- *(lang-typescript)* Enforce strict typing rules and add anti-pattern evaluations
- *(cloudflare)* Integrate Cloudflare operations into the agent lifecycle kit
- Improve UX on index.html
- *(release)* Wire git-cliff changelog and GitHub Releases (#32)
- *(install)* Prefer SHA-256 verified install over curl|sh (#34)
- *(ontology)* Typed kit index, knowledge getters, and memory allowlist (#47)
- Ontology
- Migrate site to React
- Add new asset images for the web application

### 🐛 Bug Fixes

- Update analytics script source and configuration in 404.html and index.html
- Remove unnecessary send parameter from analytics script in 404.html and index.html
- *(release)* Version-scope GitHub release notes and sync tags (#45)
- Track kit site assemble sources for Pages deploy (#48)

### 🧰 Maintenance & Dependencies

- *(edd)* Remove otelop demo shell, keep closed-loop kit spans (#30)
- *(security)* SECURITY, CONTRIBUTING, Dependabot, and CodeQL (#37)
- Fold promote into verify and drop redundant EDD workflow (#43)
- Update package.json scripts and improve README clarity

### 📚 Documentation

- *(philosophy)* Add applicability opt-out and seed kit ADRs (#36)
- Refresh kit value review and track open findings (#44)

## 2026-08-31

### 🚀 Features

- Harden and streamline setup, including one line install
- Enhance cursor configuration handling in MCP and project initialization
- *(edd)* Agent eval depth metrics, safety, and dataset hygiene
- *(site)* Today job flow, stronger demo, and first-session onboarding (#25)
- *(edd)* Otelop via mise, shadow eval CLI, and OTel fixtures (#28)
- *(debug)* Promote IDE agent misses to EDD via debug and lessons (#29)

### 🐛 Bug Fixes

- Update installation instructions to use sh instead of bash for improved compatibility
- *(site)* Mobile job command copy and balanced job grid (#26)
- *(site)* Lock Around the eval loop to a 2x2 grid (#27)

### 🧰 Maintenance & Dependencies

- Remove obsolete .skill-lock.json file as part of cleanup
- Publish meaningful GitHub Actions job summaries (#24)

## 2026-08-30

### 🚀 Features

- Tweak styling
- Index.html performance improvement
- *(evals)* Add Eval-Driven Development (EDD) harness
- *(evals)* Enrich EDD Markdown reports with failure traces
- *(mcp)* Thin bootstrap and kit-knowledge context split
- *(skills)* Encode human-centric voice in agent-copy
- *(skills)* Wire agent-copy into docs and orchestration routing
- *(eval)* Enhance eval scripts and datasets for improved routing and knowledge evaluation
- *(site)* Add lifecycle section and diagrams to enhance documentation

### 🐛 Bug Fixes

- *(site)* Restore full-bleed interactive D3 constellation
- *(site)* Restyle Start here docs as a readable path grid
- *(site)* Update 404 page and links for EDD guide

### 🧰 Maintenance & Dependencies

- *(site)* Update links and metadata for Eval-Driven Development

### 📚 Documentation

- Put Eval-Driven Development front and center
- *(edd)* Polish EDD links, copy, and report path consistency
- Lead with product value and EDD as the agentic default

### 🎨 Styling

- *(site)* Humanize landing copy and soften AI-default visuals
- *(site)* Align EDD badge color with teal palette
- *(site)* Update layout and spacing for improved responsiveness and consistency

## 2026-08-28

### 🚀 Features

- Improve evals and scripts
- Implement comprehensive evaluation benchmark suites and individual skill-level test definitions
- Implement security and supply chain audit tools with CI integration and anti-pattern evaluation suites
- Add SKILL.md frontmatter validation, high-entropy secret detection, external skill pinning, and pre-commit hook installation script.
- Implement husky-based git hooks, enforce stricter CI security, and add schema validation for evals
- Implement agent lifecycle kit with IDE configuration templates, skill trigger evaluation harness, and automated CI validation.
- Add co-located evaluation suites and standard documentation for agent skills
- Add kit CLI, new agent-copy skill, and revamp project documentation
- Configure GitHub Pages deployment workflow and add documentation link to README
- Add index.html landing page for GitHub Pages
- Homepage fun

### ⚙️ Refactoring & Performance

- Update CI actions to use tags and expand security scanner to support versioned pins
- Standardize agent bootstrap documentation paths and update lifecycle roles in README and workspace configuration

### 🧰 Maintenance & Dependencies

- Migrate package manager from npm to pnpm in scripts and CI workflow

## 2026-08-13

### 🚀 Features

- Fold TDD short loop and expand kit roles, profiles, MCPs

### 🐛 Bug Fixes

- Make agent-prune discoverable via model invocation

## 2026-08-10

### 📚 Documentation

- Require conventional titles for commits and PRs

## 2026-08-08

### 🧰 Maintenance & Dependencies

- Update .gitignore to exclude pnpm store database file
- Update .gitignore to include environment files and secrets

## 2026-08-07

### 🚀 Features

- Add agent-debug skill with hypothesis-driven SOP and tooling

## 2026-08-06

### 🚀 Features

- Update .gitignore to exclude upstream skills and enhance documentation for skills structure
- Add complexity hotspots SOP and extend agent-prune with complexity track

## 2026-08-03

### 🚀 Features

- Add MCP library with compose profiles and install wiring
- Expand MCP catalog with collab and project profiles
- Add Chrome DevTools, Cloudflare, Next.js, LinkedIn, Bitwarden, Polyglot MCPs
- Add Obsidian MCP to personal profile
- Add Raspberry Pi MCP via SSH to lab profile
- Sync official Cloudflare and Vercel skills via gh skill
- Add agent-adr for sparse MADR records under docs/ADRs
- Introduce dead-code pruning and pre-commit checks; update documentation for agent skills and handover process

## 2026-08-02

### 🚀 Features

- Treat tests as behavior catalog in lifecycle design
- Add agent-xfn for cross-functional quality tests
- Enforce behavior catalog and XFN across the lifecycle

## 2026-07-25

### 🚀 Features

- YAGNI coding

## 2026-07-24

### 🚀 Features

- Lifecycle role skills, language/framework profiles
- Lessons for learning loop, including retro
- Add csharp skill and rename dotnet skill

### ⚙️ Refactoring & Performance

- Update documentation for clarity and consistency; enhance coding philosophy with DDD, vertical slices, and clean code principles
- Rename and restructure AGENTS.md and GEMINI.md for clarity; update installation instructions and project integration guidance
