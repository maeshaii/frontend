# Frontend Merge Workflow & Conflict Resolution Guide

## Branching Policy
- **main**: Always production-ready. No direct commits.
- **feature/your-feature**: For new features or fixes. Branch from latest main.
- **dev**: (Optional) Integration branch for QA/testing before main.
- **Pull Requests**: All merges to main must go through a PR and code review.

## Safe Merge Workflow
1. **Sync your branch**
   ```sh
   git checkout main
   git pull origin main
   git checkout feature/your-feature
   git merge main
   ```
2. **Resolve Conflicts**
   - Open conflicted files. Look for:
     ```
     <<<<<<< HEAD
     ...your code...
     =======
     ...incoming code...
     >>>>>>> branch-name
     ```
   - **Best Practice:**
     - Combine logic where possible, do not just pick one side.
     - Remove all conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`).
     - Test the merged code before committing.
     - For React/TypeScript, always check for:
       - Correct imports
       - Working component state/props
       - No duplicate or missing logic
       - UI consistency
   - If unsure, ask a teammate or reviewer for a second opinion.

3. **Test Locally**
   - Run the app: `npm start` or `yarn start`
   - Check all affected pages/components.
   - Run linter: `npm run lint` or `yarn lint`

4. **Commit and Push**
   ```sh
   git add .
   git commit -m "Resolve merge conflicts: combine logic from main and feature/your-feature"
   git push origin feature/your-feature
   ```

5. **Open a Pull Request**
   - Go to GitHub and open a PR from your feature branch to main.
   - Request review from at least one teammate.

## Tips for Clean Merges
- Always pull the latest main before starting work and before opening a PR.
- Never leave conflict markers in committed code.
- Prefer combining logic and keeping all working features from both branches.
- If a conflict is too complex, discuss with your team before merging.
- Document any non-obvious merge decisions in the PR description.

---

**For questions or help, tag a senior dev or your team lead.**
