export type Cert = {
  name: string;
  issuer: string;
  icon: string; // short monogram, fallback/alt
  logo?: string; // file in public/certs
  issued?: string; // e.g. "Sep 2026"
  expired?: string;
  progress?: number; // 0-99 = in progress (greyed out); omit when earned
};

// Newest first. To add an in-progress cert, set `progress` and drop `issued`.
export const certifications: Cert[] = [
  // Course: 178 of 214 lessons complete
  { name: 'Certified Kubernetes Application Developer (CKAD)', issuer: 'CNCF / Linux Foundation', icon: 'K8s', logo: 'kubernetes.svg', progress: Math.floor((178 / 214) * 100) },
  { name: 'AWS Certified Solutions Architect – Associate', issuer: 'Amazon Web Services', icon: 'AWS', logo: 'amazonaws.svg', issued: 'Sep 2026' },
  { name: 'AWS Certified Cloud Practitioner', issuer: 'Amazon Web Services', icon: 'AWS', logo: 'amazonaws.svg', issued: 'May 2026' },
  { name: 'Learn Robot Studio', issuer: 'Udemy', icon: 'RBT', logo: 'udemy.svg', issued: 'Oct 2023' },
  { name: 'APAC Movicon Training', issuer: 'Emerson', icon: 'MOV', logo: 'emerson.png' },
  { name: 'IELTS Academic', issuer: 'IELTS Official', icon: 'IELTS', logo: 'ielts.svg', issued: 'Feb 2022', expired: 'Feb 2024' },
  { name: 'Mastering Modbus TCP/IP Network Communication', issuer: 'Udemy', icon: 'MOD', logo: 'udemy.svg', issued: 'Jan 2022' },
  { name: 'Mastering Modbus RS485 Network Communication', issuer: 'Udemy', icon: 'MOD', logo: 'udemy.svg', issued: 'Dec 2021' },
  { name: 'Hirschmann Industrial Network Professional (HiNP)', issuer: 'Belden Inc.', icon: 'HIR', logo: 'belden.svg', issued: 'Dec 2021' },
  { name: 'Hirschmann Industrial Ethernet Specialist (HiES)', issuer: 'Belden Inc.', icon: 'HIR', logo: 'belden.svg', issued: 'Nov 2021' },
  { name: 'Control Systems: From Mathematical Modelling to PID Control', issuer: 'Udemy', icon: 'PID', logo: 'udemy.svg', issued: 'Nov 2021' },
  { name: 'Node.js Essential Training', issuer: 'LinkedIn', icon: 'JS', logo: 'linkedin.svg', issued: 'Feb 2021' },
  { name: 'Structuring Machine Learning Projects', issuer: 'Coursera', icon: 'ML', logo: 'coursera.svg', issued: 'Feb 2021' },
  { name: 'Improving Deep Neural Networks: Hyperparameter Tuning, Regularization and Optimization', issuer: 'Coursera', icon: 'DL', logo: 'coursera.svg', issued: 'Feb 2021' },
  { name: 'Neural Networks and Deep Learning', issuer: 'Coursera', icon: 'DL', logo: 'coursera.svg', issued: 'Jan 2021' },
];
