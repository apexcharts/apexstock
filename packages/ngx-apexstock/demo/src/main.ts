import "zone.js";
import ApexCharts from "apexcharts";
import { bootstrapApplication } from "@angular/platform-browser";
import { AppComponent } from "./app.component";

// The ApexStock core expects ApexCharts as a global (its peer dependency),
// the same way the plain-HTML examples load it via a <script> tag.
(globalThis as unknown as { ApexCharts: unknown }).ApexCharts = ApexCharts;

bootstrapApplication(AppComponent).catch((err) => console.error(err));
