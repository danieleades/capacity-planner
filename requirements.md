# Requirements

This document is a proposal and set of requirements for a simple web app that allows users to do 'capacity-based' planning of work packages across several software teams.

## High-level requirements

- users can list and prioritise work packages
- users can plan the available capacity for each team, per month
- users can assign work packages to teams (in order)
- users can see when a team's backlog will be completed, as a function of their capacity and the size of the work packages assigned to them

## In Words

a group of stakeholders wish to have complex discussions about prioritising work packages across multiple teams. The challenge right now, is that without a capacity-based planning tool, it's hard to know how 'full' the backlog currently is. We want to use this tool to short-circuit discussions:

- "I can see that all teams have a backlog for the next 6 months, and none of the newly-proposed work packages are higher priority than the ones already in the backlog, so there's no reason to discuss this further."
- "I can see that team A has 3 months of work, but team B has only 1 month of work. Let's rebalance."
- "Team A's capacity will be impacted due to a new project, let's see what impact that has on the backlog."

NB: we don't need to support parallel work packages. We can assume we prioritise work packages in order, and it is within the gift of project teams to parallelise work

## Design Principles

- Start small, and iterate. KISS, YAGNI, DRY.
- use proven, well-used technologies.
- prefer existing solutions and external libraries over custom solutions.
- refactor regularly, keep the code simple, lean, minimal.
- don't worry about backwards compatibility- this is a prototype.
- linting and test coverage are very important.
- use CLIs and other tools for scaffolding and running commands when appropriate, rather than writing them from scratch
