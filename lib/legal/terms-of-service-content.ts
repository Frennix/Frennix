import {
  FRENNIX_SUPPORT_EMAIL,
  LEGAL_COMPANY_NAME,
  LEGAL_LAST_UPDATED,
} from "./constants";
import type { LegalDocument } from "./types";
import { legalBullets, legalParagraph, legalSubsection } from "./types";

export const termsOfServiceDocument: LegalDocument = {
  title: "Terms of Service",
  lastUpdated: LEGAL_LAST_UPDATED,
  intro: [
    legalParagraph("Welcome to Frennix."),
    legalParagraph(
      'These Terms of Service ("Terms") govern your access to and use of Frennix, including Frennix websites, progressive web applications, mobile experiences, features, content, and related services.'
    ),
    legalParagraph('In these Terms, "Frennix," "we," "us," and "our" refer to Frennix.'),
    legalParagraph('"You" and "user" refer to any person who accesses or uses Frennix.'),
    legalParagraph("By creating an account, accessing Frennix, or using the service, you agree to these Terms."),
    legalParagraph("If you do not agree to these Terms, do not use Frennix."),
  ],
  sections: [
    {
      title: "1. About Frennix",
      blocks: [
        legalParagraph("Frennix is a fitness-focused social platform designed to help people:"),
        legalBullets([
          "Find training partners",
          "Connect with other people interested in fitness",
          "Share workouts and fitness-related content",
          "Communicate with other users",
          "Participate in fitness events",
          "Participate in challenges",
          "Build fitness communities",
        ]),
        legalParagraph(
          "Frennix's purpose is fitness, training, accountability, community, and social connection relating to fitness."
        ),
        legalParagraph("Frennix is not a dating service."),
      ],
    },
    {
      title: "2. Eligibility",
      blocks: [
        legalParagraph("You must be at least 13 years old to use Frennix."),
        legalParagraph(
          "If the law where you live requires parental or guardian consent for someone your age to use an online service, you may use Frennix only with any consent required by law."
        ),
        legalParagraph("By creating an account, you represent that:"),
        legalBullets([
          "You meet the applicable age requirements",
          "The information you provide is truthful to the best of your knowledge",
          "You are legally permitted to use the service",
          "You will comply with these Terms",
        ]),
        legalParagraph("Frennix may implement additional protections or restrictions for minors."),
      ],
    },
    {
      title: "3. Your Account",
      blocks: [
        legalParagraph("Certain Frennix features require an account."),
        legalParagraph("You agree to:"),
        legalBullets([
          "Provide reasonably accurate account information",
          "Keep your login credentials secure",
          "Not allow unauthorized persons to use your account",
          "Notify Frennix if you believe your account has been compromised",
          "Take responsibility for activity performed through your account to the extent permitted by law",
        ]),
        legalParagraph("You may not:"),
        legalBullets([
          "Create an account for someone without authorization",
          "Impersonate another person",
          "Misrepresent your identity for fraudulent or harmful purposes",
          "Sell or transfer your account without permission",
          "Use another person's account without authorization",
        ]),
      ],
    },
    {
      title: "4. Training-Partner Discovery",
      blocks: [
        legalParagraph(
          "Frennix includes discovery and matching tools that may help users identify potential training partners based on information such as:"
        ),
        legalBullets([
          "Fitness interests",
          "Workout activities",
          "Fitness goals",
          "Training preferences",
          "Availability",
          "Location or distance",
          "Profile information",
        ]),
        legalParagraph("A recommendation, match, connection, or appearance in Discover does not mean that Frennix has:"),
        legalBullets([
          "Verified compatibility",
          "Endorsed the person",
          "Performed a comprehensive background check",
          "Guaranteed the person's identity",
          "Guaranteed their fitness qualifications",
          "Guaranteed their intentions",
          "Guaranteed their behavior",
          "Guaranteed their safety",
        ]),
        legalParagraph(
          "Users are responsible for deciding whether and how to communicate or meet with another user."
        ),
      ],
    },
    {
      title: "5. Frennix Is Not a Dating Service",
      blocks: [
        legalParagraph("Frennix is designed for fitness and training-partner connections."),
        legalParagraph(
          "The existence of matching, discovery, messaging, profiles, or connection features should not be interpreted as representing Frennix as a dating or romantic matchmaking service."
        ),
        legalParagraph("Users must respect the purpose of the platform and the boundaries of other users."),
        legalParagraph("Unwanted romantic or sexual harassment may violate these Terms."),
      ],
    },
    {
      title: "6. Meeting Other Users in Person",
      blocks: [
        legalParagraph("Meeting another person through an online platform involves risk."),
        legalParagraph("Frennix does not control what users do outside the platform."),
        legalParagraph(
          "When meeting another Frennix user, you should exercise reasonable judgment and safety precautions."
        ),
        legalParagraph("Examples include:"),
        legalBullets([
          "Meet in a public or established fitness location when appropriate",
          "Tell someone you trust where you are going",
          "Use your own transportation when appropriate",
          "Do not provide unnecessary financial or highly sensitive personal information",
          "Do not feel obligated to meet anyone",
          "Leave an interaction if you feel unsafe",
          "Use blocking and reporting tools when appropriate",
          "Contact appropriate emergency services when facing an immediate emergency",
        ]),
        legalParagraph("You are responsible for your decision to meet or train with another user."),
      ],
    },
    {
      title: "7. Fitness and Health Disclaimer",
      blocks: [
        legalParagraph("Physical activity carries inherent risks."),
        legalParagraph("These may include:"),
        legalBullets([
          "Muscle strain",
          "Joint injury",
          "Falls",
          "Dehydration",
          "Cardiovascular events",
          "Accidents",
          "Serious injury",
          "Other health complications",
        ]),
        legalParagraph("Frennix does not provide medical advice."),
        legalParagraph(
          "Unless specifically stated otherwise, information provided by users through Frennix should not be treated as professional medical advice, diagnosis, or treatment."
        ),
        legalParagraph(
          "You are responsible for determining whether a workout, training activity, event, challenge, exercise, or training partner is appropriate for you."
        ),
        legalParagraph(
          "You should consult an appropriate healthcare professional before beginning or significantly changing an exercise program when appropriate for your circumstances."
        ),
        legalParagraph(
          "If you experience symptoms requiring medical attention, seek appropriate medical care."
        ),
      ],
    },
    {
      title: "8. Trainers and Fitness Professionals",
      blocks: [
        legalParagraph(
          "Some Frennix users may identify themselves as trainers, coaches, instructors, fitness professionals, or similar professionals."
        ),
        legalParagraph("Unless Frennix explicitly states otherwise, Frennix does not guarantee:"),
        legalBullets([
          "Credentials",
          "Certifications",
          "Licenses",
          "Experience",
          "Insurance",
          "Background",
          "Quality of services",
          "Professional competence",
        ]),
        legalParagraph(
          "Users are responsible for evaluating the qualifications of any person they choose to train with or hire."
        ),
        legalParagraph(
          "If Frennix introduces formal trainer verification in the future, the meaning and limitations of that verification should be disclosed separately."
        ),
      ],
    },
    {
      title: "9. User Content",
      blocks: [
        legalParagraph("Frennix allows users to create, upload, post, send, or otherwise share content."),
        legalParagraph('"User Content" may include:'),
        legalBullets([
          "Photos",
          "Videos",
          "Stories",
          "Workout posts",
          "Captions",
          "Comments",
          "Messages",
          "Profile information",
          "Event information",
          "Challenge content",
          "Other material submitted by users",
        ]),
        legalParagraph("You retain ownership of content that you own."),
        legalParagraph(
          "By posting User Content to areas of Frennix intended to be shared with others, you grant Frennix a non-exclusive, worldwide, royalty-free license to host, store, reproduce, display, process, transmit, format, and distribute that content only as reasonably necessary to:"
        ),
        legalBullets([
          "Operate Frennix",
          "Display the content according to your chosen use of the service",
          "Provide service functionality",
          "Maintain and improve Frennix",
          "Protect the service and its users",
          "Comply with legal obligations",
        ]),
        legalParagraph("This license does not transfer ownership of your User Content to Frennix."),
        legalParagraph(
          "The license ends when the content is deleted from Frennix's active systems except where continued retention is reasonably necessary for backups, legal compliance, safety, dispute resolution, or other legitimate purposes."
        ),
      ],
    },
    {
      title: "10. Your Responsibility for Content",
      blocks: [
        legalParagraph("You are responsible for content you submit to Frennix."),
        legalParagraph("You represent that you have the necessary rights to upload or share the content you submit."),
        legalParagraph("Do not upload content that:"),
        legalBullets([
          "You do not have permission to use",
          "Violates another person's privacy",
          "Violates intellectual property rights",
          "Is fraudulent",
          "Is unlawful",
          "Contains malicious software",
          "Exploits another person",
          "Violates these Terms",
        ]),
      ],
    },
    {
      title: "11. Prohibited Conduct",
      blocks: [
        legalParagraph("You may not use Frennix to:"),
        legalBullets([
          "Harass another person",
          "Bully another person",
          "Threaten violence",
          "Stalk another person",
          "Intimidate another person",
          "Discriminate unlawfully",
          "Exploit or abuse another person",
          "Engage in unwanted sexual conduct",
          "Send repeated unwanted messages",
          "Impersonate another person",
          "Create fraudulent accounts",
          "Scam or defraud another person",
          "Request money through deceptive conduct",
          "Distribute malware",
          "Attempt unauthorized access to another account",
          "Circumvent security systems",
          "Scrape or harvest user information without authorization",
          "Spam users",
          "Manipulate platform functionality",
          "Abuse reporting systems",
          "Encourage illegal conduct",
          "Publish another person's sensitive private information without authorization",
          "Use Frennix to facilitate human trafficking or exploitation",
          "Upload illegal content",
          "Use Frennix in a way that creates unreasonable risk to another person",
        ]),
      ],
    },
    {
      title: "12. Harassment and Unwanted Contact",
      blocks: [
        legalParagraph("Frennix is intended to create positive fitness connections."),
        legalParagraph("Users must respect other users' boundaries."),
        legalParagraph(
          "If a user declines a connection, blocks you, asks you to stop contacting them, or otherwise indicates that communication is unwanted, you must respect that decision."
        ),
        legalParagraph(
          "Repeatedly attempting to contact a person who has clearly asked you to stop may result in restriction or termination of your account."
        ),
      ],
    },
    {
      title: "13. Sexual Exploitation and Intimate Content",
      blocks: [
        legalParagraph("Users may not use Frennix to:"),
        legalBullets([
          "Share intimate images of another person without consent",
          "Threaten to share intimate images",
          "Solicit sexual content from minors",
          "Exploit minors",
          "Distribute illegal sexual content",
          "Engage in sexual extortion",
          "Use intimate material to harass or threaten someone",
        ]),
        legalParagraph(
          "Frennix may remove such content, preserve relevant evidence where legally appropriate, restrict accounts, and cooperate with lawful authorities."
        ),
      ],
    },
    {
      title: "14. Blocking and Reporting",
      blocks: [
        legalParagraph(
          "Frennix may provide tools allowing users to block or report other users or content."
        ),
        legalParagraph("Users may report conduct they reasonably believe violates:"),
        legalBullets(["These Terms", "Frennix safety rules", "Applicable law"]),
        legalParagraph("Frennix may investigate reports at its discretion and take action it considers appropriate."),
        legalParagraph("Actions may include:"),
        legalBullets([
          "Warning users",
          "Removing content",
          "Limiting account functionality",
          "Restricting communication",
          "Suspending accounts",
          "Terminating accounts",
        ]),
        legalParagraph("Submitting intentionally false or abusive reports may itself violate these Terms."),
      ],
    },
    {
      title: "15. Events",
      blocks: [
        legalParagraph(
          "Frennix may allow users to create, organize, promote, discover, or attend events."
        ),
        legalParagraph(
          "Unless Frennix expressly identifies itself as an event organizer, user-created events are organized by the users responsible for those events."
        ),
        legalParagraph("Frennix does not guarantee:"),
        legalBullets([
          "Event safety",
          "Attendance",
          "Venue availability",
          "Organizer qualifications",
          "Event quality",
          "Accuracy of event information",
          "Conduct of attendees",
        ]),
        legalParagraph("Event participants are responsible for evaluating the risks associated with attending."),
      ],
    },
    {
      title: "16. Challenges",
      blocks: [
        legalParagraph("Frennix may allow users to participate in fitness challenges."),
        legalParagraph("Participation is voluntary."),
        legalParagraph(
          "Users are responsible for choosing activities appropriate for their own fitness level and health circumstances."
        ),
        legalParagraph(
          "Users should not perform dangerous activity solely to complete a challenge, maintain a streak, compete with another user, or obtain recognition within Frennix."
        ),
      ],
    },
    {
      title: "17. Third-Party Services",
      blocks: [
        legalParagraph("Frennix may link to or integrate with third-party services."),
        legalParagraph("Third-party services are controlled by their respective providers."),
        legalParagraph("Frennix is not responsible for:"),
        legalBullets([
          "Their content",
          "Their terms",
          "Their privacy practices",
          "Their availability",
          "Their actions",
        ]),
        legalParagraph("Use of a third-party service may be subject to separate terms."),
      ],
    },
    {
      title: "18. Beta Features",
      blocks: [
        legalParagraph(
          "Some or all of Frennix may be offered in beta, preview, experimental, or testing form."
        ),
        legalParagraph("Beta features may:"),
        legalBullets([
          "Contain bugs",
          "Change without notice",
          "Perform incorrectly",
          "Become temporarily unavailable",
          "Lose or incorrectly display information",
          "Be modified or removed",
        ]),
        legalParagraph(
          "By participating in a beta, you acknowledge that the service is still being tested."
        ),
        legalParagraph("Please report bugs using Frennix's feedback tools when available."),
      ],
    },
    {
      title: "19. Feedback",
      blocks: [
        legalParagraph(
          "If you provide feedback, ideas, feature suggestions, or other recommendations regarding Frennix, you allow Frennix to use that feedback to improve or develop the service without an obligation to compensate you."
        ),
        legalParagraph("This provision does not transfer ownership of your unrelated User Content."),
      ],
    },
    {
      title: "20. Intellectual Property",
      blocks: [
        legalParagraph(
          "Frennix and its associated branding, software, design, logos, graphics, interfaces, and other materials are protected by applicable intellectual property laws."
        ),
        legalParagraph("Except where expressly permitted, you may not:"),
        legalBullets([
          "Copy Frennix branding",
          "Misrepresent yourself as Frennix",
          "Reproduce proprietary portions of the service",
          "Sell unauthorized copies",
          "Reverse engineer protected portions of the service except where applicable law expressly permits it",
        ]),
        legalParagraph("Frennix respects the intellectual property rights of others."),
      ],
    },
    {
      title: "21. Copyright Complaints",
      blocks: [
        legalParagraph(
          "If you believe content on Frennix infringes intellectual property rights you own, contact:"
        ),
        legalParagraph(FRENNIX_SUPPORT_EMAIL),
        legalParagraph("Include enough information for us to identify:"),
        legalBullets([
          "The copyrighted or protected work",
          "The allegedly infringing content",
          "Where the content appears",
          "Your contact information",
          "The basis of your claim",
        ]),
        legalParagraph("Additional information may be requested when required by applicable law."),
      ],
    },
    {
      title: "22. Account Suspension or Termination",
      blocks: [
        legalParagraph(
          "Frennix may suspend, restrict, or terminate an account when reasonably necessary because of:"
        ),
        legalBullets([
          "Violation of these Terms",
          "Fraud",
          "Harassment",
          "Safety concerns",
          "Illegal conduct",
          "Repeated abuse",
          "Unauthorized access",
          "Security threats",
          "Risk to users or Frennix",
          "Legal requirements",
        ]),
        legalParagraph("Where appropriate, Frennix may provide notice or an opportunity to appeal."),
        legalParagraph("Severe conduct may result in immediate action."),
      ],
    },
    {
      title: "23. User Account Deletion",
      blocks: [
        legalParagraph("You may stop using Frennix at any time."),
        legalParagraph(
          "Where available, you may request deletion of your account through Frennix account settings or by contacting:"
        ),
        legalParagraph(FRENNIX_SUPPORT_EMAIL),
        legalParagraph(
          "Deletion is subject to the Privacy Policy and any information Frennix is permitted or required to retain."
        ),
      ],
    },
    {
      title: "24. Service Changes",
      blocks: [
        legalParagraph("Frennix is continually developing."),
        legalParagraph("We may add, change, redesign, suspend, or discontinue features."),
        legalParagraph("We do not guarantee that any specific feature will remain available permanently."),
        legalParagraph("Where legally required, users will receive appropriate notice of material changes."),
      ],
    },
    {
      title: "25. Availability",
      blocks: [
        legalParagraph("We aim to provide a reliable service but cannot guarantee uninterrupted availability."),
        legalParagraph("Frennix may be unavailable because of:"),
        legalBullets([
          "Maintenance",
          "Software bugs",
          "Hosting outages",
          "Internet failures",
          "Security incidents",
          "Third-party service failures",
          "Updates",
          "Circumstances outside our reasonable control",
        ]),
      ],
    },
    {
      title: "26. No Guarantee of Connection Results",
      blocks: [
        legalParagraph("Frennix does not guarantee that you will:"),
        legalBullets([
          "Find a training partner",
          "Receive a connection request",
          "Receive responses",
          "Become friends with another user",
          "Successfully organize a workout",
          "Reach a fitness goal",
          "Receive professional fitness results",
        ]),
        legalParagraph("Results depend on numerous factors outside Frennix's control."),
      ],
    },
    {
      title: "27. Disclaimer of Warranties",
      blocks: [
        legalParagraph(
          'TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, FRENNIX IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS.'
        ),
        legalParagraph("FRENNIX DOES NOT GUARANTEE THAT:"),
        legalBullets([
          "THE SERVICE WILL ALWAYS BE AVAILABLE",
          "EVERY FEATURE WILL OPERATE WITHOUT ERROR",
          "ALL USER INFORMATION WILL BE ACCURATE",
          "ALL USERS WILL BE WHO THEY CLAIM TO BE",
          "EVERY TRAINING PARTNER WILL BE SAFE OR APPROPRIATE",
          "USERS WILL ACHIEVE PARTICULAR FITNESS RESULTS",
        ]),
        legalParagraph(
          "NOTHING IN THESE TERMS EXCLUDES WARRANTIES OR RIGHTS THAT CANNOT LAWFULLY BE EXCLUDED."
        ),
      ],
    },
    {
      title: "28. Limitation of Liability",
      blocks: [
        legalParagraph(
          "TO THE MAXIMUM EXTENT PERMITTED BY LAW, FRENNIX WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE SERVICE."
        ),
        legalParagraph("THIS MAY INCLUDE DAMAGES RELATED TO:"),
        legalBullets([
          "USER INTERACTIONS",
          "IN-PERSON MEETINGS",
          "FITNESS ACTIVITIES",
          "USER-GENERATED CONTENT",
          "LOSS OF DATA",
          "SERVICE INTERRUPTIONS",
          "THIRD-PARTY CONDUCT",
        ]),
        legalParagraph("THESE LIMITATIONS APPLY ONLY TO THE EXTENT PERMITTED BY APPLICABLE LAW."),
        legalParagraph(
          "NOTHING IN THESE TERMS LIMITS LIABILITY THAT CANNOT LEGALLY BE LIMITED OR EXCLUDED."
        ),
      ],
    },
    {
      title: "29. Indemnification",
      blocks: [
        legalParagraph(
          "To the extent permitted by law, you agree to be responsible for claims, liabilities, damages, and reasonable costs arising from your unlawful use of Frennix, your violation of these Terms, or content you submit that infringes the rights of another person."
        ),
        legalParagraph("This provision does not apply where prohibited by law."),
      ],
    },
    {
      title: "30. Governing Law",
      blocks: [
        legalParagraph(
          "These Terms are governed by the laws of the State of Oregon, without regard to conflict-of-law principles, except where applicable law requires otherwise."
        ),
        legalParagraph(
          "Nothing in these Terms eliminates consumer protections or other rights that cannot legally be waived."
        ),
      ],
    },
    {
      title: "31. Changes to These Terms",
      blocks: [
        legalParagraph("We may update these Terms as Frennix evolves."),
        legalParagraph("When material changes occur, we may notify users through:"),
        legalBullets(["Frennix", "Email", "Website notice", "Another reasonable method"]),
        legalParagraph('The "Last Updated" date indicates the most recent revision.'),
        legalParagraph(
          "Where applicable law requires affirmative consent to revised terms, Frennix will obtain that consent."
        ),
      ],
    },
    {
      title: "32. Severability",
      blocks: [
        legalParagraph(
          "If a portion of these Terms is determined to be unlawful or unenforceable, the remaining portions will continue to apply to the extent permitted by law."
        ),
      ],
    },
    {
      title: "33. No Waiver",
      blocks: [
        legalParagraph(
          "If Frennix does not immediately enforce a provision of these Terms, that does not mean Frennix permanently waives the right to enforce it."
        ),
      ],
    },
    {
      title: "34. Entire Agreement",
      blocks: [
        legalParagraph(
          "These Terms, together with the Frennix Privacy Policy and any additional terms presented for specific features, constitute the agreement between you and Frennix concerning your use of the service."
        ),
      ],
    },
  ],
  contact: {
    heading: "35. Contact Us",
    company: LEGAL_COMPANY_NAME,
    email: FRENNIX_SUPPORT_EMAIL,
  },
};
