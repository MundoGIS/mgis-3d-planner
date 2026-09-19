# Third-Party Licenses

This project includes bundled third-party components. The project itself is licensed under MPL-2.0, and the bundled third-party licenses are listed below for quick review.

| Component | Location | License | Notes |
| --- | --- | --- | --- |
| Assimp | `public/Thirdparty/Assimp/` | BSD-style license | Keep the bundled `LICENSE` file and attribution notices. |
| Cesium | `public/Thirdparty/Cesium/` | Apache License 2.0 | The Cesium bundle contains embedded third-party notices inside the build output. |
| Cesium Navigation | `public/Thirdparty/cesium-navigation-1.1.8/` | Apache License 2.0 | The package metadata declares `Apache-2.0`. |
| Pannellum | `public/Thirdparty/pannellum-2.5.6/` | MIT License | Keep the upstream license text if you redistribute the files. |

## Compatibility Note

These bundled licenses are generally compatible with MPL-2.0 when their notices are preserved and the third-party code stays clearly separated from the project sources.

Important points:

1. Do not remove or rewrite the upstream license notices inside vendor files.
2. If you add new third-party assets, document their license here before publishing.
3. Check asset-specific licenses for example media or sample files, not just the code license.

## Current Assessment

No direct license conflict was identified in the currently bundled third-party code.

This file is a project note, not legal advice.