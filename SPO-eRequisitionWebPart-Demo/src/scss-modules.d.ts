// Ambient typing for SCSS module imports (`import styles from './X.module.scss'`).
// The SPFx SASS build generates concrete per-file typings at build time; this
// fallback lets `tsc`/editors resolve the imports before that codegen runs.
declare module '*.module.scss' {
  const styles: { [className: string]: string };
  export default styles;
}
