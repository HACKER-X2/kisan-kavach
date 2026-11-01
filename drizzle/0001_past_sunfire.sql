CREATE TABLE `cadastral_plots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`khasraNo` varchar(50) NOT NULL,
	`village` varchar(100) NOT NULL,
	`district` varchar(100) NOT NULL,
	`state` varchar(100) NOT NULL,
	`totalAreaHa` decimal(8,2) NOT NULL,
	`sownCrop` varchar(50) NOT NULL,
	`farmerName` varchar(100) NOT NULL,
	`farmerPhone` varchar(20) NOT NULL,
	`geometry` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cadastral_plots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `claim_records` (
	`id` varchar(64) NOT NULL,
	`plotId` int NOT NULL,
	`floodEventId` int NOT NULL,
	`inundationPercentage` decimal(5,2) NOT NULL,
	`cropLossCategory` varchar(20) NOT NULL,
	`smsStatus` enum('QUEUED','SENT','DELIVERED','FAILED') NOT NULL DEFAULT 'QUEUED',
	`claimStatus` enum('INTIMATION_GENERATED','PENDING_CONSENT','SUBMITTED_NCIP','DECLINED') NOT NULL DEFAULT 'INTIMATION_GENERATED',
	`smsSentAt` timestamp,
	`farmerResponse` varchar(10),
	`consentTimestamp` timestamp,
	`ncipPayload` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `claim_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `consent_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`claimId` varchar(64) NOT NULL,
	`tokenHash` varchar(160) NOT NULL,
	`consentChannel` varchar(30) NOT NULL DEFAULT 'SMS',
	`signedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `consent_tokens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `flood_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`acquisitionDate` timestamp NOT NULL,
	`satelliteSource` varchar(50) NOT NULL DEFAULT 'Sentinel-1 SAR',
	`affectedDistrict` varchar(100) NOT NULL,
	`thresholdMethod` varchar(120) NOT NULL,
	`thresholdDb` decimal(5,2) NOT NULL,
	`inundationGeojson` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `flood_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sms_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`claimId` varchar(64) NOT NULL,
	`direction` enum('OUTBOUND','INBOUND') NOT NULL,
	`payload` text NOT NULL,
	`deliveryStatus` varchar(30) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sms_events_id` PRIMARY KEY(`id`)
);
