[![DeepWiki](https://img.shields.io/badge/DeepWiki-downforacross%2Fdownforacross.com-blue.svg?logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAyCAYAAAAnWDnqAAAAAXNSR0IArs4c6QAAA05JREFUaEPtmUtyEzEQhtWTQyQLHNak2AB7ZnyXZMEjXMGeK/AIi+QuHrMnbChYY7MIh8g01fJoopFb0uhhEqqcbWTp06/uv1saEDv4O3n3dV60RfP947Mm9/SQc0ICFQgzfc4CYZoTPAswgSJCCUJUnAAoRHOAUOcATwbmVLWdGoH//PB8mnKqScAhsD0kYP3j/Yt5LPQe2KvcXmGvRHcDnpxfL2zOYJ1mFwrryWTz0advv1Ut4CJgf5uhDuDj5eUcAUoahrdY/56ebRWeraTjMt/00Sh3UDtjgHtQNHwcRGOC98BJEAEymycmYcWwOprTgcB6VZ5JK5TAJ+fXGLBm3FDAmn6oPPjR4rKCAoJCal2eAiQp2x0vxTPB3ALO2CRkwmDy5WohzBDwSEFKRwPbknEggCPB/imwrycgxX2NzoMCHhPkDwqYMr9tRcP5qNrMZHkVnOjRMWwLCcr8ohBVb1OMjxLwGCvjTikrsBOiA6fNyCrm8V1rP93iVPpwaE+gO0SsWmPiXB+jikdf6SizrT5qKasx5j8ABbHpFTx+vFXp9EnYQmLx02h1QTTrl6eDqxLnGjporxl3NL3agEvXdT0WmEost648sQOYAeJS9Q7bfUVoMGnjo4AZdUMQku50McDcMWcBPvr0SzbTAFDfvJqwLzgxwATnCgnp4wDl6Aa+Ax283gghmj+vj7feE2KBBRMW3FzOpLOADl0Isb5587h/U4gGvkt5v60Z1VLG8BhYjbzRwyQZemwAd6cCR5/XFWLYZRIMpX39AR0tjaGGiGzLVyhse5C9RKC6ai42ppWPKiBagOvaYk8lO7DajerabOZP46Lby5wKjw1HCRx7p9sVMOWGzb/vA1hwiWc6jm3MvQDTogQkiqIhJV0nBQBTU+3okKCFDy9WwferkHjtxib7t3xIUQtHxnIwtx4mpg26/HfwVNVDb4oI9RHmx5WGelRVlrtiw43zboCLaxv46AZeB3IlTkwouebTr1y2NjSpHz68WNFjHvupy3q8TFn3Hos2IAk4Ju5dCo8B3wP7VPr/FGaKiG+T+v+TQqIrOqMTL1VdWV1DdmcbO8KXBz6esmYWYKPwDL5b5FA1a0hwapHiom0r/cKaoqr+27/XcrS5UwSMbQAAAABJRU5ErkJggg==)](https://deepwiki.com/downforacross/downforacross.com)


## crosswithfriends 

Crosswithfriends is an online website for sharing crosswords and playing collaboratively with friends in real time.

It is hosted at https://crosswithfriends.com/.

# 🚨 Repository Status & Branching Strategy

**Important:** This repository is currently in a transition phase between the Legacy Production app and the V2 Rewrite. Please ensure you are working on the correct branch.

| Environment | Branch | Status | URL |
| :--- | :--- | :--- | :--- |
| **Production** | `master` | 🔒 **Maintenance Only**<br>Critical hotfixes for the live app. | [crosswithfriends.com](https://www.crosswithfriends.com) |
| **V2** | `v2-rewrite` | 🚀 **Active Development**<br>All new features and the rewrite codebase. | [v2.crosswithfriends.com](https://v2.crosswithfriends.com) |

---

## 🛠️ Which branch should I use?

### 1. Working on the New App (Default)
Most development should happen here. This is the new codebase (React/Vite/Node).
   `git checkout v2-rewrite`
   `git pull origin v2-rewrite`

### 2. Fixing a Bug in Production (Legacy)
Only check this out if you need to patch the currently live application.

    `git checkout master`
    `git pull origin master`
    
# ⚠️ Do not merge v2-rewrite into master!


## Contributing

If you notice a bug or have a feature request, feel free to open an issue.

### Getting Started

1. Install `nvm` and `yarn`

2. Clone repo and cd to repo root.

   `git clone https://github.com/ScaleOvenStove/crosswithfriends.git`
   `cd crosswithfriends`

3. Use node v18
   `nvm install`
   `nvm use`
   `nvm alias default 18` (optional)

4. Install Dependencies
   `yarn`

5. Run frontend server
   `yarn start`

### Contributing

Cross with Friends is open to contributions from developers of any level or experience.
See the `Getting Started` section for instructions on setting up.

Join the [discord](https://discord.gg/RmjCV8EZ73) for discussion.

### Tips

Developing for mobile web:

- Mobile device emulator: https://appetize.io/demo?device=nexus7&scale=50&orientation=portrait&osVersion=9.0
- Public urls for local server: ngrok, https://ngrok.com/
- Remote debugging (e.g. safari developer mode) tips: https://support.brightcove.com/debugging-mobile-devices

### Other resources

- https://firebase.google.com/docs/database/web/start (intro to firebase realtime database)
- https://reactjs.org/tutorial/tutorial.html (intro to react)
- https://discord.gg/RmjCV8EZ73 (community discord)
