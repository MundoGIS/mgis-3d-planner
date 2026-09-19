# Contribution Guide

Thanks for your interest in MGIS 3D-Planner. This guide explains how to contribute code, report issues, and keep changes aligned with the project.

## Before contributing

- Check existing issues and pull requests before starting larger work.
- Explain the problem you are solving and the expected behavior.
- Contributions must be compatible with the project license, MPL-2.0.
- If you add or update bundled third-party files, keep their original notices and update [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).

## Recommended workflow

1. Fork or branch from `master`.
2. Keep changes focused and avoid unrelated formatting noise.
3. Update docs when the behavior, setup, or file layout changes.
4. Run the relevant checks for the touched area, such as `npm install`, `npm start`, or `node --check app.js`.
5. Open a pull request with a short summary, the motivation, and any testing notes.

## Bug reports and feature requests

- Include the Node.js version, operating system, and exact steps to reproduce.
- Add screenshots or sample data when the issue is visual or data-driven.
- Mention whether the problem occurs in the backend, frontend, or both.

## Project-specific notes

- This project is a Node.js, Express, and Cesium-based GIS application.
- If you touch the 3D viewer, check the files under `public/js/3d/` and the matching `views/*.ejs` templates.
- If you touch uploads or data handling, check the routes under `routes/` and confirm the file paths still match the structure in `data/`.

## License and third-party code

- Do not remove upstream license headers or bundled license files.
- When adding a new external library, verify its license is compatible with MPL-2.0 before merging.
- Preserve notices for third-party assets under `public/Thirdparty/`.

## Need help?

For questions about contribution scope or project structure, open an issue or contact the project maintainers through the repository channels.
