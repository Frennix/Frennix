import {
  FRENNIX_SUPPORT_EMAIL,
  LEGAL_COMPANY_NAME,
  LEGAL_LAST_UPDATED,
} from "./constants";
import type { LegalDocument } from "./types";
import { legalBullets, legalParagraph, legalSubsection } from "./types";

export const privacyPolicyDocument: LegalDocument = {
  title: "Privacy Policy",
  lastUpdated: LEGAL_LAST_UPDATED,
  intro: [
    legalParagraph("Welcome to Frennix."),
    legalParagraph(
      'Frennix ("Frennix," "we," "us," or "our") provides a fitness-focused social platform designed to help people connect with training partners, share fitness activity, communicate with other users, participate in fitness-related events and challenges, and build a fitness community.'
    ),
    legalParagraph(
      "Your privacy is important to us. This Privacy Policy explains what information we collect, how we use it, when we may share it, the choices you have regarding your information, and how you can contact us about privacy matters."
    ),
    legalParagraph(
      "By accessing or using Frennix, you acknowledge that you have read and understood this Privacy Policy."
    ),
  ],
  sections: [
    {
      title: "1. Information We Collect",
      blocks: [
        legalParagraph(
          "We may collect information that you provide directly to Frennix, information generated through your use of the service, and certain information from your device."
        ),
        legalParagraph("The information we collect depends on the features you use."),
        legalSubsection("A. Account Information"),
        legalParagraph("When you create or maintain a Frennix account, we may collect information such as:"),
        legalBullets([
          "Name",
          "Username",
          "Email address",
          "Password or authentication credentials",
          "Profile photograph",
          "Account identifiers",
          "Date of birth or age information, if requested",
          "Other account information you choose to provide",
        ]),
        legalParagraph(
          "Passwords should be stored and processed through the authentication systems used by Frennix and should not be displayed publicly."
        ),
        legalSubsection("B. Profile Information"),
        legalParagraph("Users may choose to add information to their Frennix profiles, including:"),
        legalBullets([
          'Profile photos',
          'Biography or "About Me" information',
          "Fitness interests",
          "Fitness goals",
          "Workout preferences",
          "Preferred activities",
          "Training experience",
          "Training availability",
          "General location information",
          "Other information voluntarily added to a profile",
        ]),
        legalParagraph("Some profile information may be visible to other Frennix users."),
        legalParagraph(
          "Users should avoid placing highly sensitive personal information in public profile fields."
        ),
        legalSubsection("C. User Content"),
        legalParagraph("Frennix allows users to create and share content."),
        legalParagraph("This may include:"),
        legalBullets([
          "Workout posts",
          "Photos",
          "Videos",
          "Stories",
          "Captions",
          "Comments",
          "Likes or other interactions",
          "Fitness activities",
          "Challenge participation",
          "Event information",
          "Messages",
          "Other content submitted through Frennix",
        ]),
        legalParagraph(
          "Content that you intentionally post to public or community portions of Frennix may be visible to other users."
        ),
        legalParagraph(
          "Private messages are intended to be visible to the participants in the conversation and may also be processed by our systems and service providers as necessary to operate, secure, maintain, investigate abuse of, or comply with legal obligations relating to the service."
        ),
        legalSubsection("D. Discovery and Training-Partner Information"),
        legalParagraph(
          "Frennix includes features designed to help users discover and connect with potential training partners."
        ),
        legalParagraph("To provide these features, we may process information such as:"),
        legalBullets([
          "Fitness interests",
          "Workout activities",
          "Fitness goals",
          "Training preferences",
          "Availability",
          "General location or distance",
          "Discovery visibility settings",
          "Connection or match activity",
          "Requests sent or received",
          "Connections accepted or declined",
        ]),
        legalParagraph(
          "Frennix is a fitness and training-partner platform. Its matching and discovery features are intended to help users find people with compatible fitness interests and training goals."
        ),
        legalParagraph("Frennix is not intended to operate as a dating service."),
        legalSubsection("E. Location Information"),
        legalParagraph(
          "Certain Frennix features may use location information to help users discover relevant training partners, activities, events, or other location-based content."
        ),
        legalParagraph("Depending on your device permissions and the feature being used, location information may include:"),
        legalBullets([
          "Approximate location",
          "Device-provided location information",
          "City or general geographic area",
          "Distance between users",
        ]),
        legalParagraph(
          "If a feature requests access to device location services, your device operating system may allow you to grant, deny, or modify that permission."
        ),
        legalParagraph(
          "Where location is optional, users may change applicable location or discovery settings through their device or Frennix settings."
        ),
        legalParagraph(
          "We encourage users not to publicly share exact home addresses, workplace locations, or other sensitive location information."
        ),
        legalSubsection("F. Messages and Communications"),
        legalParagraph("When you communicate through Frennix, we may process information including:"),
        legalBullets([
          "Message text",
          "Photos or other media sent through messages",
          "Sender and recipient identifiers",
          "Date and time information",
          "Read or delivery status",
          "Information necessary to provide messaging functionality",
        ]),
        legalParagraph(
          "Frennix may process communications when reasonably necessary to operate the service, enforce our Terms, investigate reported misconduct, protect users, prevent fraud or abuse, or comply with law."
        ),
        legalSubsection("G. Events and Challenges"),
        legalParagraph(
          "If you create, join, or interact with a Frennix event or challenge, we may collect or process information such as:"
        ),
        legalBullets([
          "Event name",
          "Event description",
          "Event date and time",
          "General event location",
          "Participation status",
          "Organizer information",
          "Challenge participation",
          "Progress or completion information",
          "Related posts or interactions",
        ]),
        legalSubsection("H. Notifications"),
        legalParagraph(
          "If you enable notifications, Frennix may use device or account identifiers necessary to provide notifications relating to:"
        ),
        legalBullets([
          "Messages",
          "Training-partner activity",
          "Match or connection requests",
          "Comments or interactions",
          "Events",
          "Challenges",
          "Account activity",
          "Service announcements",
        ]),
        legalParagraph(
          "You can generally control notification permissions through your device and, where available, Frennix notification settings."
        ),
        legalSubsection("I. Device, Technical, and Diagnostic Information"),
        legalParagraph("When you use Frennix, certain technical information may be generated automatically."),
        legalParagraph("This may include:"),
        legalBullets([
          "Device type",
          "Operating system",
          "Browser type",
          "App or PWA version",
          "IP address",
          "Date and time of access",
          "Error information",
          "Crash logs",
          "Diagnostic logs",
          "Network requests or failures",
          "Notification setup information",
          "Other information reasonably necessary to diagnose technical problems and maintain the service",
        ]),
        legalParagraph(
          "Frennix includes beta diagnostic functionality that may allow users to copy or provide diagnostic information when reporting bugs."
        ),
        legalSubsection("J. Usage Information"),
        legalParagraph("We may collect information about how users interact with Frennix, such as:"),
        legalBullets([
          "Features accessed",
          "Pages viewed",
          "Posts created",
          "Connections made",
          "Events joined",
          "General interaction patterns",
          "Session information",
          "Error events",
        ]),
        legalParagraph(
          "We may use this information to operate, troubleshoot, secure, and improve Frennix."
        ),
      ],
    },
    {
      title: "2. How We Use Information",
      blocks: [
        legalParagraph("We may use information collected through Frennix to:"),
        legalBullets([
          "Create and maintain user accounts",
          "Authenticate users",
          "Display user profiles",
          "Provide the Frennix social feed",
          "Allow users to create and interact with posts and stories",
          "Provide training-partner discovery and matching features",
          "Facilitate communication between users",
          "Provide messaging functionality",
          "Create and manage events and challenges",
          "Deliver notifications",
          "Personalize relevant portions of the user experience",
          "Maintain discovery and privacy settings",
          "Respond to support requests",
          "Investigate bugs and technical problems",
          "Improve performance and reliability",
          "Develop and improve Frennix features",
          "Prevent fraud, spam, abuse, harassment, or misuse",
          "Enforce our Terms of Service",
          "Protect the rights, property, and safety of Frennix and its users",
          "Comply with applicable law and valid legal requests",
        ]),
      ],
    },
    {
      title: "3. How Information May Be Shared",
      blocks: [
        legalParagraph("We do not disclose personal information simply because someone asks for it."),
        legalParagraph("Information may be shared in the circumstances described below."),
        legalSubsection("A. With Other Frennix Users"),
        legalParagraph(
          "Information you choose to make visible through your profile, posts, stories, events, challenges, discovery profile, or other community features may be visible to other Frennix users."
        ),
        legalParagraph("Depending on the feature, this may include:"),
        legalBullets([
          "Your name or username",
          "Profile picture",
          "Biography",
          "Fitness goals",
          "Fitness interests",
          "Workout preferences",
          "Posts",
          "Stories",
          "Event participation",
          "Training-partner information",
          "General location or distance information",
          "Online or activity status, where enabled",
        ]),
        legalSubsection("B. With People You Communicate With"),
        legalParagraph(
          "When you send a message, connection request, event invitation, or other communication, relevant account and communication information will be provided to the intended recipient."
        ),
        legalSubsection("C. Service Providers"),
        legalParagraph(
          "Frennix may use third-party companies and infrastructure providers to help operate the service."
        ),
        legalParagraph("These may include providers of:"),
        legalBullets([
          "Hosting",
          "Databases",
          "Authentication",
          "Cloud infrastructure",
          "Media storage",
          "Notifications",
          "Error monitoring",
          "Analytics",
          "Email",
          "Security",
          "Technical infrastructure",
        ]),
        legalParagraph(
          "For example, Frennix currently uses technologies and infrastructure that may include Supabase and Vercel."
        ),
        legalParagraph(
          "These providers may process information on our behalf as necessary to provide their services."
        ),
        legalParagraph("Third-party providers have their own privacy and security practices."),
        legalSubsection("D. Legal and Safety Purposes"),
        legalParagraph(
          "We may preserve, access, or disclose information when we reasonably believe doing so is necessary to:"
        ),
        legalBullets([
          "Comply with applicable law",
          "Respond to a valid subpoena, court order, or legal process",
          "Protect users from harm",
          "Investigate suspected fraud or abuse",
          "Investigate harassment or threats",
          "Enforce our Terms of Service",
          "Protect Frennix's legal rights",
          "Protect the rights or safety of another person",
          "Address emergencies involving possible danger to a person",
        ]),
        legalSubsection("E. Business Transfers"),
        legalParagraph(
          "If Frennix becomes involved in a merger, financing, acquisition, restructuring, sale of assets, or similar business transaction, information may be transferred as part of that transaction as permitted by law."
        ),
        legalParagraph("Users will receive notice where legally required."),
      ],
    },
    {
      title: "4. Selling and Targeted Advertising",
      blocks: [
        legalParagraph("Frennix does not intend to sell personal information in exchange for money."),
        legalParagraph(
          "If Frennix's practices change in the future, this Privacy Policy will be updated and users will be provided any rights or choices required by applicable law."
        ),
        legalParagraph(
          "Frennix does not currently describe itself as using personal information for third-party targeted advertising."
        ),
        legalParagraph(
          "If targeted advertising or similar advertising technologies are introduced in the future, this Privacy Policy and any required privacy controls must be updated before those practices are implemented."
        ),
      ],
    },
    {
      title: "5. Discovery Visibility",
      blocks: [
        legalParagraph("Frennix is designed to help users find training partners."),
        legalParagraph(
          "Certain profile information may therefore appear in Discover or other training-partner features depending on your settings and the design of the service."
        ),
        legalParagraph(
          "Where privacy or discovery controls are available, users may be able to adjust whether they appear in training-partner discovery."
        ),
        legalParagraph(
          "Changing discovery visibility does not necessarily delete your Frennix account or remove information you have independently shared elsewhere on the service."
        ),
      ],
    },
    {
      title: "6. Location Privacy",
      blocks: [
        legalParagraph("Location-related information should be used only for legitimate Frennix features."),
        legalParagraph(
          "Frennix should not display a user's exact private residential address to other users unless the user intentionally publishes that information."
        ),
        legalParagraph(
          "Users should exercise caution before sharing exact locations publicly or with someone they have not previously met."
        ),
        legalParagraph(
          "Device-level location permissions may be controlled through your phone or browser settings."
        ),
      ],
    },
    {
      title: "7. Public Information",
      blocks: [
        legalParagraph("Some portions of Frennix are social by design."),
        legalParagraph("Information you choose to post publicly or share with other users may be:"),
        legalBullets([
          "Seen by other users",
          "Screenshotted",
          "Copied",
          "Re-shared outside Frennix",
          "Retained by another user",
        ]),
        legalParagraph(
          "Frennix cannot control what another person does with information that you voluntarily share with them."
        ),
        legalParagraph("Please consider this before publishing personal information."),
      ],
    },
    {
      title: "8. Data Retention",
      blocks: [
        legalParagraph("We retain information for as long as reasonably necessary to:"),
        legalBullets([
          "Provide Frennix",
          "Maintain your account",
          "Fulfill the purposes described in this Privacy Policy",
          "Resolve disputes",
          "Investigate abuse or security incidents",
          "Meet legal obligations",
          "Enforce agreements",
        ]),
        legalParagraph(
          "Retention periods may vary depending on the type of information and why it is being processed."
        ),
        legalParagraph(
          "If you delete certain content or request account deletion, some information may remain temporarily in backups, logs, security records, or records required for legitimate legal or operational purposes."
        ),
        legalParagraph(
          "Frennix should not state a specific deletion timeframe unless that timeframe has actually been implemented and verified."
        ),
      ],
    },
    {
      title: "9. Account Deletion and Data Requests",
      blocks: [
        legalParagraph(
          "Users may request deletion of their Frennix account and associated personal information, subject to information that Frennix is legally permitted or required to retain."
        ),
        legalParagraph("Where an in-app account deletion feature is available, users should use that feature."),
        legalParagraph("Users may also contact:"),
        legalParagraph(FRENNIX_SUPPORT_EMAIL),
        legalParagraph("with the subject:"),
        legalParagraph("Account Deletion Request"),
        legalParagraph(
          "We may need to verify that a request comes from the account owner before completing it."
        ),
        legalParagraph("Deleting an account may result in loss of access to:"),
        legalBullets([
          "Profile information",
          "Posts",
          "Training-partner connections",
          "Messages",
          "Events",
          "Challenge activity",
          "Other account information",
        ]),
        legalParagraph(
          "Certain information may be retained where legally permitted or reasonably necessary for security, fraud prevention, dispute resolution, or compliance purposes."
        ),
      ],
    },
    {
      title: "10. Privacy Rights",
      blocks: [
        legalParagraph(
          "Depending on where you live and applicable law, you may have rights regarding your personal information."
        ),
        legalParagraph("These may include the right to request:"),
        legalBullets([
          "Confirmation that Frennix processes your personal information",
          "Access to certain personal information",
          "Correction of inaccurate personal information",
          "Deletion of personal information",
          "A portable copy of certain personal information",
          "Information regarding categories of third parties receiving information",
          "Opt-out rights relating to certain forms of sale, targeted advertising, or profiling, where applicable",
          "Withdrawal of consent where processing is based on consent",
        ]),
        legalParagraph("Rights differ by jurisdiction and may be subject to exceptions."),
        legalParagraph("To submit a privacy request, contact:"),
        legalParagraph(FRENNIX_SUPPORT_EMAIL),
        legalParagraph("Use the subject:"),
        legalParagraph("Privacy Request"),
        legalParagraph(
          "We may take reasonable steps to verify your identity before fulfilling a request."
        ),
        legalParagraph(
          "Where applicable law provides a right to appeal a denied privacy request, you may submit an appeal using the same contact method and identify your request as:"
        ),
        legalParagraph("Privacy Request Appeal"),
      ],
    },
    {
      title: "11. Oregon Privacy Rights",
      blocks: [
        legalParagraph(
          "Oregon residents may have rights under the Oregon Consumer Privacy Act when the law applies to Frennix and the processing at issue."
        ),
        legalParagraph("These may include rights relating to:"),
        legalBullets([
          "Access",
          "Correction",
          "Deletion",
          "Data portability",
          "Information about certain third-party disclosures",
          "Opting out of certain sales of personal data",
          "Opting out of targeted advertising",
          "Opting out of certain profiling",
          "Consent relating to sensitive data where required",
        ]),
        legalParagraph(
          "Where legally required, Frennix will also honor applicable recognized universal opt-out preference signals."
        ),
        legalParagraph(
          "The availability of a particular right depends on whether the law applies to Frennix and the particular processing activity."
        ),
      ],
    },
    {
      title: "12. Sensitive Information",
      blocks: [
        legalParagraph(
          "Certain information can be considered sensitive under applicable privacy laws."
        ),
        legalParagraph(
          "Users should not provide sensitive information unless it is reasonably necessary to use a Frennix feature."
        ),
        legalParagraph(
          "Where applicable law requires consent before processing sensitive personal information, Frennix will seek appropriate consent."
        ),
        legalParagraph(
          "Frennix does not intend for users to publish highly sensitive personal information publicly."
        ),
      ],
    },
    {
      title: "13. Security",
      blocks: [
        legalParagraph(
          "We take reasonable administrative, technical, and organizational measures designed to protect information under our control."
        ),
        legalParagraph(
          "However, no website, application, database, network, transmission method, or storage system can be guaranteed to be completely secure."
        ),
        legalParagraph("Users are responsible for maintaining the confidentiality of their login credentials."),
        legalParagraph("If you believe your account has been compromised, contact Frennix promptly."),
      ],
    },
    {
      title: "14. Children and Minors",
      blocks: [
        legalParagraph("Frennix is not intended for children under 13 years of age."),
        legalParagraph("Children under 13 may not create a Frennix account."),
        legalParagraph(
          "Frennix does not knowingly seek to collect personal information from children under 13 without authorization required by law."
        ),
        legalParagraph(
          "If we learn that personal information from a child under 13 was collected in violation of applicable law, we will take appropriate steps to address the information."
        ),
        legalParagraph("If you believe a child under 13 has provided personal information through Frennix, contact:"),
        legalParagraph(FRENNIX_SUPPORT_EMAIL),
        legalParagraph("Additional protections or restrictions may apply to teenage users under applicable law."),
      ],
    },
    {
      title: "15. User-Generated Content and Safety",
      blocks: [
        legalParagraph("Frennix includes user-generated content and communication features."),
        legalParagraph("Users may report content or behavior that violates Frennix policies."),
        legalParagraph("Frennix may review reported content and take actions including:"),
        legalBullets([
          "Removing content",
          "Restricting functionality",
          "Suspending an account",
          "Terminating an account",
          "Preserving information where necessary for safety or legal reasons",
        ]),
        legalParagraph(
          "Users should not assume that Frennix reviews every message, post, or interaction before it appears."
        ),
      ],
    },
    {
      title: "16. Third-Party Links",
      blocks: [
        legalParagraph(
          "Frennix may contain links to websites, events, businesses, or services operated by third parties."
        ),
        legalParagraph("Frennix is not responsible for the privacy practices of third-party services."),
        legalParagraph(
          "Users should review the privacy practices of those services before providing personal information to them."
        ),
      ],
    },
    {
      title: "17. Beta Service",
      blocks: [
        legalParagraph("Frennix may operate features in beta or testing stages."),
        legalParagraph(
          "During beta testing, we may collect additional diagnostic information or user feedback for the purpose of identifying:"
        ),
        legalBullets([
          "Bugs",
          "Crashes",
          "Performance issues",
          "Compatibility problems",
          "Failed requests",
          "Notification problems",
          "User experience issues",
        ]),
        legalParagraph(
          "Users may voluntarily provide feedback through Frennix's feedback and diagnostic tools."
        ),
      ],
    },
    {
      title: "18. Changes to This Privacy Policy",
      blocks: [
        legalParagraph("We may update this Privacy Policy as Frennix changes."),
        legalParagraph(
          "When material changes are made, we may provide notice through the app, website, email, or another reasonable method where required."
        ),
        legalParagraph(
          'The "Last Updated" date at the top of this policy indicates when this Privacy Policy was most recently revised.'
        ),
        legalParagraph("Continued use of Frennix following an update is subject to applicable law."),
      ],
    },
  ],
  contact: {
    heading: "19. Contact Us",
    company: LEGAL_COMPANY_NAME,
    email: FRENNIX_SUPPORT_EMAIL,
  },
};
