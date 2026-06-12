import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Separator } from '../components/ui/separator';
import {
  Github,
  Mail,
  ExternalLink,
  MapPin,
  Calendar,
  Briefcase,
  GraduationCap,
  Cpu,
  Wrench,
  Award,
  Twitter,
} from 'lucide-react';

const PROFILE_IMG = 'https://avatars.githubusercontent.com/u/50710155?v=4';

const skills = {
  'Embedded & Firmware': ['C / C++', 'STM32 / ARM Cortex-M', 'ESP32 & Arduino', 'FreeRTOS', 'SPI / I2C / UART', 'DMA'],
  'Hardware & PCB': ['Altium Designer', 'PCB Layout & Soldering', 'Verilog HDL', 'ModelSim', 'FPGA (Altera DE2)', 'Oscilloscopes'],
  'Industrial & IoT': ['PLC (Siemens/Emerson)', 'Modbus TCP/IP', 'Variable-Frequency Drives', 'Cognex Vision Sensors', 'Raspberry Pi', 'Zigbee'],
};

const experience = [
  {
    id: 1,
    role: 'Customer Care Specialist',
    company: 'Miovision',
    period: 'Oct 2024 – Present',
    location: 'Kitchener, ON (Remote)',
    bullets: [
      'Serve as the primary technical interface for proprietary hardware, camera sensors, and cloud software integrations.',
      'Diagnose, troubleshoot, and perform root-cause analyses on complex networking, camera feeds, and hardware bugs.',
      'Install, upgrade, and maintain system firmware, training customers on interface operations and diagnostics.',
      'Coordinate directly with product engineering to report software issues and track updates, managing RMAs and warranty processing.',
    ],
  },
  {
    id: 2,
    role: 'IT Service Desk Student Technician',
    company: 'Conestoga College',
    period: 'Sep 2023 – Jan 2024 & May 2024 – Aug 2024',
    location: 'Cambridge, ON',
    bullets: [
      'Provided hardware, software, printing, and networking infrastructure support across campus labs.',
      'Utilized Microsoft Azure, Active Directory, and ITSM ticketing tools for user account provisioning and resolution.',
      'Authored technical guides and troubleshooting documentation in the college\'s centralized knowledge base.',
    ],
  },
  {
    id: 3,
    role: 'Manufacturing (Industrial Process) Intern',
    company: 'Miovision',
    period: 'Jan 2024 – Apr 2024',
    location: 'Kitchener, ON',
    bullets: [
      'Designed and deployed an automated Raspberry Pi issue-tracking system integrated with Slack and Google Sheets via QR codes.',
      'Conducted detailed time studies and bottleneck analyses, implementing workflow improvements that reduced cycle times.',
      'Updated and authored Standard Operating Procedures (SOPs) to align operations with ISO 9001 quality guidelines.',
    ],
  },
  {
    id: 4,
    role: 'Control Systems Engineer',
    company: 'Control Logic',
    period: 'Nov 2021 – May 2023',
    location: 'Australia (Remote)',
    bullets: [
      'Programmed Programmable Logic Controllers (PLCs) and configured HMIs (RedLion, Emerson/Panasonic) for industrial plants.',
      'Resolved field bugs with variable-frequency drives (VFDs), motor controllers, and safety systems.',
      'Designed wiring schematics, panel layouts, and Piping and Instrumentation Diagrams (P&IDs).',
    ],
  },
];

const education = [
  {
    id: 1,
    degree: 'Graduate Certificate in Embedded Systems Development',
    school: 'Conestoga College',
    period: 'May 2023 – Aug 2024',
    location: 'Cambridge, ON',
    details: 'Grade: 95.34% (President\'s Honor List) — Ranked top student in cohort. Coursework in bare-metal C, RTOS, Verilog HDL, and PCB Layout.',
  },
  {
    id: 2,
    degree: 'Bachelor of Engineering (Hons.) in Electrical & Computer Systems Engineering',
    school: 'Monash University',
    period: 'Feb 2017 – Jul 2021',
    location: 'Malaysia Campus',
    details: 'Grade: 81.63% (Dean\'s List 2017–2018). Received Monash High Achiever entrance scholarship. Core focus on digital circuits, controls, and computer vision.',
  },
];

const projects = [
  {
    id: 1,
    name: '16-bit Custom Microprocessor',
    description:
      'Designed, simulated, and verified a 16-bit microprocessor from scratch in behavioral Verilog. Built core ALU, Register File, and microcode ROM.',
    tags: ['Verilog', 'ModelSim', 'FPGA'],
  },
  {
    id: 2,
    name: 'FPV Ackerman RC Car',
    description:
      'Developed a smart steering vehicle powered by ESP32-S3 and Flutter. Implemented low-latency video streaming, PWM control, and MPU6050 telemetry.',
    tags: ['ESP32-S3', 'Flutter', 'Flask', 'I2C'],
  },
  {
    id: 3,
    name: 'STM32F411 Test PCB',
    description:
      'Designed a dual-layer PCB to breakout STM32 functionalities, including motor drivers and SPI displays. Hand-soldered SMD components.',
    tags: ['Altium Designer', 'PCB Layout', 'C++'],
  },
];

const awards = [
  {
    title: 'President\'s Honor List (Oct 2024)',
    desc: 'Awarded for graduating top of the Embedded Systems cohort at Conestoga College with a 95.34% average.',
  },
  {
    title: 'Top in Country - AS-Level Physics (2015)',
    desc: 'Awarded by Cambridge International Examinations for achieving the highest score in Sri Lanka.',
  },
  {
    title: 'Top in Country - O-Level Additional Mathematics (2014)',
    desc: 'Awarded by Cambridge International Examinations for the highest national score.',
  },
];

export function HomePage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl space-y-14 animate-fade-in">
      {/* Hero */}
      <section className="flex flex-col sm:flex-row gap-8 items-start">
        <img
          src={PROFILE_IMG}
          alt="Sahan Gamage profile photo"
          className="w-28 h-28 rounded-full object-cover shrink-0 ring-2 ring-border shadow-md"
        />
        <div className="space-y-4 flex-1">
          <div>
            <h1 className="text-4xl mb-1 font-bold tracking-tight">Sahan Gamage</h1>
            <p className="text-lg opacity-60 font-medium">Embedded Systems & Electronics Engineer</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm opacity-60">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              Kitchener-Waterloo, ON
            </span>
            <a href="mailto:mgk.sahan@gmail.com" className="flex items-center gap-1.5 hover:opacity-100 transition-opacity">
              <Mail className="w-3.5 h-3.5" />
              mgk.sahan@gmail.com
            </a>
            <a href="https://github.com/mgksahan" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:opacity-100 transition-opacity">
              <Github className="w-3.5 h-3.5" />
              github.com/mgksahan
            </a>
            <a href="https://twitter.com/mgksahan" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:opacity-100 transition-opacity">
              <Twitter className="w-3.5 h-3.5" />
              twitter.com/mgksahan
            </a>
          </div>
          <p className="opacity-75 leading-relaxed max-w-2xl text-base">
            I am an Embedded Systems Developer and Electronics Engineer specializing in digital logic design, 
            low-level firmware architecture, and high-performance IoT applications. I bridge bits and atoms 
            with custom PCB designs, microprocessor simulation, and robust cloud-connected hardware systems.
          </p>
        </div>
      </section>

      <Separator />

      {/* Skills */}
      <section className="space-y-4">
        <h2 className="flex items-center gap-2 opacity-90 font-bold text-xl">
          <Wrench className="w-5 h-5 text-primary" />
          Systems & Hardware DNA
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Object.entries(skills).map(([category, items]) => (
            <div key={category} className="space-y-2.5 p-4 rounded-xl border bg-card/40">
              <p className="text-xs font-bold opacity-50 uppercase tracking-wider">{category}</p>
              <div className="flex flex-wrap gap-1.5">
                {items.map((skill) => (
                  <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <Separator />

      {/* Projects */}
      <section className="space-y-4">
        <h2 className="flex items-center gap-2 opacity-90 font-bold text-xl">
          <Cpu className="w-5 h-5 text-primary" />
          Featured Engineering Projects
        </h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Card key={project.id} className="hover:shadow-md transition-all border-muted flex flex-col justify-between">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-start justify-between gap-2 text-base font-bold">
                  <span>{project.name}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 flex-1 flex flex-col justify-between">
                <p className="text-xs opacity-70 leading-relaxed">{project.description}</p>
                <div className="flex flex-wrap gap-1">
                  {project.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0.5">{tag}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator />

      {/* Experience */}
      <section className="space-y-6">
        <h2 className="flex items-center gap-2 opacity-90 font-bold text-xl">
          <Briefcase className="w-5 h-5 text-primary" />
          Professional Experience
        </h2>
        <div className="space-y-8">
          {experience.map((job) => (
            <div key={job.id} className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <div>
                  <p className="font-semibold text-lg">{job.role}</p>
                  <p className="text-sm opacity-60 font-medium">{job.company} · {job.location}</p>
                </div>
                <span className="flex items-center gap-1 text-xs opacity-50 shrink-0 bg-muted/65 px-2.5 py-1 rounded-md font-mono self-start sm:self-center">
                  <Calendar className="w-3.5 h-3.5" />
                  {job.period}
                </span>
              </div>
              <ul className="space-y-1.5 pl-4 border-l-2 border-muted/80 text-sm">
                {job.bullets.map((bullet, i) => (
                  <li key={i} className="opacity-75 leading-relaxed text-left">{bullet}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <Separator />

      {/* Education */}
      <section className="space-y-6">
        <h2 className="flex items-center gap-2 opacity-90 font-bold text-xl">
          <GraduationCap className="w-5 h-5 text-primary" />
          Education
        </h2>
        <div className="space-y-6">
          {education.map((ed) => (
            <div key={ed.id} className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <div>
                  <p className="font-semibold text-base">{ed.degree}</p>
                  <p className="text-sm opacity-60 font-medium">{ed.school} · {ed.location}</p>
                </div>
                <span className="flex items-center gap-1 text-xs opacity-50 shrink-0 bg-muted/65 px-2.5 py-1 rounded-md font-mono self-start sm:self-center">
                  <Calendar className="w-3.5 h-3.5" />
                  {ed.period}
                </span>
              </div>
              <p className="text-sm opacity-70 leading-relaxed">{ed.details}</p>
            </div>
          ))}
        </div>
      </section>

      <Separator />

      {/* Honors & Awards */}
      <section className="space-y-4">
        <h2 className="flex items-center gap-2 opacity-90 font-bold text-xl">
          <Award className="w-5 h-5 text-primary" />
          Honors & Academic Awards
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {awards.map((aw, i) => (
            <div key={i} className="p-4 rounded-xl border bg-card hover:shadow-sm transition-shadow space-y-1.5">
              <h4 className="font-bold text-sm text-primary flex items-start gap-1">
                <span className="text-yellow-500">🏆</span>
                <span>{aw.title}</span>
              </h4>
              <p className="text-xs opacity-70 leading-relaxed">{aw.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
