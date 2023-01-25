# Recognized Delegates Program & cbETH oracle change

## Motivation

To grow to its maximum potential, Interest Protocol needs to decentralize its ownership and put protocol control into a large group of thoughtful and intelligent participants. We would like to introduce the Recognized Delegates Program. Five percent of the total IPT supply has been earmarked to compensate delegates and reward those active in Governance of the protocol.

## Specification

### Delegate Eligibility:

* Be active in community discussion boards, staying sufficiently informed about challenges and solutions in the IP community.
* Provide an Ethereum address and/or ENS for delegation purposes.
* Include identifying details ( Delegate Name, ENS/EthereumAddress, Forum Handle(s), Alternate Means Of Contact (Twitter, Discord, Email, etc.)
* Write a brief Delegate Statement (including general voting philosophy, alignment with IP goals, and why you are the best candidate), including and d a brief list of your core values, close all conflicts of interest (potential and actual), and provide a written policy on how current or future conflicts will be handled when voting.
* Provide a list of authorized representatives if the Recognized Delegate is a team or institution;

### Compensation Eligibility:

* Communicate on the IP forum how and why a delegate voted the way they did within seven days of the close of a vote (minimum 90% of the time) in their dedicated delegate thread.
* Command voting weight greater than or equal to 1 basis point of the total IPT supply;
* Participate in at least 90% of all on-chain IP votes within the previous 90 days
* The Recognized Delegate (or one authorized representative if a team or institution) must attend at least one public protocol development call each month.

### Compensation:

Communication and vote participation metrics will use a cumulative average on a rolling window of 120 days (accounting for sickness, leave, or any other lack of activity).

Each Recognized Delegate will be entitled to a monthly compensation of:
y = (0.0989899*x+0.1010101)/12
y = Compensation (in IPT)
x = Lowest total of IPT delegated to address during that calendar month

In the event, a delegate utilizes two addresses during the same month (e.g. moving from an EOA to a multisig), the larger of the two addresses will be used for compensation purposes.

### Measurement: 

To ensure that the recognized delegates have met their responsibilities for compensation, an administrator will

* Review delegate communication on voting and reasoning ( within the specified timeframe)
* Record on-chain IP votes by delegates at vote close
* Note attendance at the public protocol development meeting
* Provide a summary of these metrics for all Recognized Delegates in a post on the Interest Protocol forum once per month

### Administration:

The administrator will dedicate an estimated 2 hours a week, compensated at 75 USDI/hour for a flat monthly compensation of 600 USDi per month.

The initial administrator will be myself, @Feems (active DAO contributor, governance engineer, and spend my free time facilitating weekly governance education sessions ). In the event the current administrator chooses to step down, a new administrator must be appointed by a governance proposal, with the following exception:

The current administrator may train a replacement who will work under the current administrator for no less than 30 days. That replacement may take over the administrator role without a vote by IP governance, provided the current administrator provides a written statement on the forum introducing the replacement at the beginning of training and handing over the position at a date of their choosing.

## cbETH
Chainlink has informed us that they are closing the cbETH/USD oracle in favor of their cbETH/ETH oracle. The proposed change switches will switch IP to use the cbETH/ETH oracle