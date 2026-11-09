export type Cert = {
  name: string;
  issuer: string;
  icon: string; // short monogram shown on the badge
  issued?: string; // e.g. "Sep 2026"
  expired?: string;
  progress?: number; // 0-99 = in progress (greyed out); omit when earned
};

// Newest first. To add an in-progress cert, set `progress` and drop `issued`.
export const certifications: Cert[] = [
  // Course: 178 of 214 lessons complete
  { name: 'Certified Kubernetes Application Developer (CKAD)', issuer: 'CNCF / Linux Foundation', icon: 'K8s', progress: Math.floor((178 / 214) * 100) },
  { name: 'AWS Certified Solutions Architect – Associate', issuer: 'Amazon Web Services', icon: 'AWS', issued: 'Sep 2026' },
  { name: 'AWS Certified Cloud Practitioner', issuer: 'Amazon Web Services', icon: 'AWS', issued: 'May 2026' },
  { name: 'Learn Robot Studio', issuer: 'Udemy', icon: 'RBT', issued: 'Oct 2023' },
  { name: 'APAC Movicon Training', issuer: 'Emerson', icon: 'MOV' },
  { name: 'IELTS Academic', issuer: 'IELTS Official', icon: 'IELTS', issued: 'Feb 2022', expired: 'Feb 2024' },
  { name: 'Mastering Modbus TCP/IP Network Communication', issuer: 'Udemy', icon: 'MOD', issued: 'Jan 2022' },
  { name: 'Mastering Modbus RS485 Network Communication', issuer: 'Udemy', icon: 'MOD', issued: 'Dec 2021' },
  { name: 'Hirschmann Industrial Network Professional (HiNP)', issuer: 'Belden Inc.', icon: 'HIR', issued: 'Dec 2021' },
  { name: 'Hirschmann Industrial Ethernet Specialist (HiES)', issuer: 'Belden Inc.', icon: 'HIR', issued: 'Nov 2021' },
  { name: 'Control Systems: From Mathematical Modelling to PID Control', issuer: 'Udemy', icon: 'PID', issued: 'Nov 2021' },
  { name: 'Node.js Essential Training', issuer: 'LinkedIn', icon: 'JS', issued: 'Feb 2021' },
  { name: 'Structuring Machine Learning Projects', issuer: 'Coursera', icon: 'ML', issued: 'Feb 2021' },
  { name: 'Improving Deep Neural Networks: Hyperparameter Tuning, Regularization and Optimization', issuer: 'Coursera', icon: 'DL', issued: 'Feb 2021' },
  { name: 'Neural Networks and Deep Learning', issuer: 'Coursera', icon: 'DL', issued: 'Jan 2021' },
];
