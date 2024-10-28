import Link from "next/link";

type _exp = {
    role: string
    company: string
    duration: string
    responsibilities: string[]
}

type _skill = {
    heading: string,
    items: string[]
}

const s: _skill[] = [
    {
        heading: "Languages",
        items: [ "C#", "Javascript", "Typescript", "Python", "Java" ]
    },
        {
        heading: "Frontend",
        items: [ "React",  "NextJs"]
    },
        {
        heading: "Backend",
        items: [ ".NET Core", "NodeJS", "Kafka", "Kafka Connect" ]
    },
        {
        heading: "Database",
        items: [  "MongoDB", "PostgreSQL", "SQL" ]
    },
    {
        heading: "CI/ CD",
        items: [ "Kubernetes", "Helm", "Docker", "Docker compose", "Github actions", "Terraform", "ArgoCD" ]
    },
    {
        heading: "Other skills",
        items: ["Public speaking", "Stakeholder management", "Customer oriented design" ]
    }
]

const e: _exp[] = [
    {
        role: "Software Engineer",
        company: "Optum, Dublin",
        duration: "Nov ‘22 - Present",
        responsibilities: [
            "Implemented bi-directional data sync with Kafka Connect for app modernization.",
            "Reduced development time by 40% using Kafka connectors instead of a custom java app.",
            "CI/ CD of data sync solution on AKS with Helm, ArgoCD, GitHub Actions, and Jenkins.",
            "Identify key metrics for monitoring and implement it using Prometheus and Grafana.",
            "Create Angular PWA poc to demonstrate offline conflict handling with CouchDB.",
            "Enhanced .NET WPF app for geriatric patient care.",
            "Python, JavaScript and bash scripting for data analysis/ modification, and automation."
        ]
    },
    {
        role: "Founder/ Fullstack Engineer",
        company: "LabelAzra, Dublin",
        duration: "Jan ‘22 - Present",
        responsibilities: [
            "Designed and built an E-commerce store using NextJS, Postgres, MedusaJS and Shadcn UI.",
            "Integrated payments, notifications, OAuth, ecommerce tracking and other crucial features."
        ]
    },
    {
        role: "Marketing Automation Specialist",
        company: "FoodMarble, Dublin",
        duration: "Feb ‘20 - Oct ‘22",
        responsibilities: [
            "20% productivity boost using a custom CRM for affiliates built with React, .NET and PostgreSQL.",
            "300% faster TikTok influencer discovery through Python web scraping and automation.",
            "Optimized speed of the above script by 200% through python multithreading."
        ]
    },
    {
        role: "Full Stack .NET Developer ",
        company: "Infosys, India",
        duration: "Feb ‘20 - Oct ‘22",
        responsibilities: [
            "20% productivity boost using a custom CRM for affiliates built with React, .NET and PostgreSQL.",
            "300% faster TikTok influencer discovery through Python web scraping and automation.",
            "Optimized speed of the above script by 200% through python multithreading."
        ]
    }
]

const prj: string[] =[
    "Books-read app to record the books I’ve completed reading.",
    "Web scraping scripts to collect house price data on daft, ticket prices on booking.com.",
    "Built a drum shooter game and crypt raider game using Unreal Engine 5 and C++.",
    "React JS, Redux task application with weather API data, and an IMDb movie app."
]

const edu: string[] = [
    "‘18 - ’19  - M.Sc. Digital Marketing, NUI Galway - 1.1",
    "Aug ‘15 - Dec ’16 - Software training at Infosys, India - 82%",
    "‘11- ’15 - B.Tech. Electronics and Instrumentation Engineering, BSA Crescent University - 81%"
]

const Line = () => {
    return <hr className="h-px mb-4 bg-gray-200 border-0 dark:bg-gray-600"/>
}

const SectionHeading = ({heading} : {heading: string}) => {
    return <h2 className="font-bold mb-6">{heading}</h2>
}

const Skill = ({skillItem}: {skillItem: _skill}) => {
    return (
        <div className="mb-5">
        <ul>
            <li className="text-base flex flex-wrap mb-4">
                <p className="mb-2 w-full font-semibold">{skillItem.heading}</p>
                <div className="flex gap-2 flex-wrap">
                    {skillItem.items.map(si => <p className="bg-slate-700 px-3 py-1 rounded-full text-nowrap">{si}</p>)}
                </div>
            </li>
        </ul>
        </div>
    )
}

const Experience = ({expItem} : {expItem: _exp}) => {
    return (
        <div className="text-sm mb-10">
            <p className="font-semibold text-lg">{expItem.role}</p>
            <p className="text-xs mb-4">{expItem.company} | {expItem.duration}</p>
            <ul className="text-base text-pretty">
                {expItem.responsibilities.map((l, index) => 
                    <li className="mb-1 list-disc">{l}</li>
                )}
            </ul>
        </div>
    )
}

export default function Resume() {

  return (
    <div className="m-auto w-[65%] mb-60 mt-16">
        <div className="text-xs mb-10">
            <h1 className="text-2xl font-semibold mb-3">Syed Yaseen</h1>
            <div className="flex underline gap-5 text-sm mb-1">
                <Link className="underline" href="https://www.linkedin.com/in/syed-yaseen-ahamed/">Linkedin</Link>
                
                <Link href="https://www.github.com/syedyaseen">Github</Link>
            </div>
            <p className=" mb-1">s.syedyaseen.s@gmail.com</p>
            <p className="mb-1">0899 523 001</p>
        </div>
        <div className="gap-24 grid grid-cols-[30%_70%]">

            {/* Left Column */}
            <div className="">
                <Line/>
                <SectionHeading heading="ABOUT"/>
                <p className="mb-16">Resourceful software engineer with more than 5 years of hands-on experience in various technologies such as .NET, React, Azure, Kubernetes eager to build interesting products.</p>

                <Line/>
                <SectionHeading heading="SKILLS"/>
                {s.map(sItem => <Skill skillItem={sItem}/>)}

                <div className="mt-10">
                    <Line/>
                    <SectionHeading heading="EDUCATION"/>
                    {edu.map(p => <li className="list-disc text-sm">{p}</li>)}
                </div>

            </div>

            {/* Right Column */}
            <div className="">
                <Line/>
                <SectionHeading heading="EXPERIENCE"/>
                {e.map(eItem => <Experience expItem={eItem}/>)}
                
                <SectionHeading heading="PROJECTS"/>
                {prj.map(p => <li className="list-disc">{p}</li>)}
            </div>
        </div>
    </div>
  )
}
