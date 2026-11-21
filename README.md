# Sheikh Kaif – Portfolio

Personal portfolio of Sheikh Kaif, a CSE graduate who builds the systems behind healthcare data: Laravel and SQL backends, Retool dashboards and machine learning models. Currently training in revenue cycle management at DocPro Health.

**Live site:** https://kaif15-14682.github.io/Personal-Portfolio/

![Portfolio home page](assets/preview.png)

## What's inside

- **Hero:** a live diagram of the work. Claims, tissue slides and patient records flow into a pipeline that steps through cleaning, joining, training and charting, and out come a Retool dashboard, a ProstadeNet grade and a paid claim. A ribbon of light runs through the whole page.
- **Projects:** a Laravel school management system, operations dashboards, the ProstadeNet thesis, Flutter apps, stroke risk prediction, a Bash password manager and the Yui & Kai planner (a shared planner for two people on shift work), each with a live visual and links to how it works and to the code. Competitions from 2021 to 2025 close the list.
- **Experience:** five roles on a timeline. The light becomes the timeline's line, and each role charges in as you reach it.
- **Skills:** each skill, and where it was used.
- **ProstadeNet:** a tissue slide on its way to a grade, with feature maps computed in your browser, and the ten tuning steps that got there.
- **Dashboards:** a Monday, seen from the Retool and SQL dashboards.
- **Stroke risk prediction:** why 94% accuracy wasn't enough.
- **Numbers from the projects, the Laravel system from the screen down to the database, and one medical claim from the front desk to paid.**
- **Contact.**

**Quick view:** the button in the top bar turns off the intro and the scroll animations and shows the whole page at once.

## Tech

One HTML file with plain CSS and JavaScript: no framework and no build step. A small WebGL2 renderer draws the ribbon of light. GSAP with ScrollTrigger drives the pinned sections and Lenis smooths scrolling, both loaded from a CDN. The fonts are Geist, Geist Mono and Instrument Serif from Google Fonts.

The page follows the reduced-motion setting, and the footer shows the page's weight and load time, measured in your browser.

## Run locally

```bash
git clone https://github.com/kaif15-14682/Personal-Portfolio.git
cd Personal-Portfolio
```

Open `index.html` in a browser.

## Structure

```
index.html   The whole site: markup, styles and scripts
assets/      Tab and home-screen icons, share image and preview image
```

## Contact

[Email](mailto:sheikhkaif977@gmail.com) · [LinkedIn](https://www.linkedin.com/in/sheikh-kaif) · [GitHub](https://github.com/kaif15-14682)
