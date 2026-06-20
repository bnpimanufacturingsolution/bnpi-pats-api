import { PrismaClient } from "../../generated/prisma";

export async function seedVendor(prisma: PrismaClient, workspaceIds: string | string[]) {
	console.log("🌱 Starting vendor seeding...");

	// Support both single ID and array of IDs
	const orgIds = Array.isArray(workspaceIds) ? workspaceIds : [workspaceIds];

	const vendorData = [
		{
			id: "607f1f77bcf86cd799439051",
			vendorId: "V001",
			name: "TechSupply Global Inc.",
			contactPerson: "Michael Chen",
			contactDesignation: "Sales Director",
			contactDepartment: "Sales",
			email: "michael.chen@techsupply.com",
			phone: "+1-555-0101",
			mobile: "+1-555-9901",
			address: "1234 Technology Drive, Silicon Valley, CA 94025",
			notes: "Primary hardware supplier, excellent delivery times",
			isDeleted: false,
		},
		{
			id: "607f1f77bcf86cd799439052",
			vendorId: "V002",
			name: "Software Solutions Ltd.",
			contactPerson: "Sarah Williams",
			contactDesignation: "Account Manager",
			contactDepartment: "Enterprise Sales",
			email: "sarah.w@softwaresolutions.com",
			phone: "+1-555-0102",
			mobile: "+1-555-9902",
			address: "567 Innovation Blvd, Boston, MA 02101",
			notes: "Licensed software provider, Microsoft and Adobe partner",
			isDeleted: false,
		},
		{
			id: "607f1f77bcf86cd799439053",
			vendorId: "V003",
			name: "NetworkPro Systems",
			contactPerson: "David Kumar",
			contactDesignation: "Technical Sales Engineer",
			contactDepartment: "Engineering",
			email: "d.kumar@networkpro.com",
			phone: "+1-555-0103",
			mobile: "+1-555-9903",
			address: "890 Network Lane, Austin, TX 78701",
			notes: "Cisco certified partner, networking equipment specialist",
			isDeleted: false,
		},
		{
			id: "607f1f77bcf86cd799439054",
			vendorId: "V004",
			name: "Office Furniture Depot",
			contactPerson: "Jennifer Martinez",
			contactDesignation: "Regional Manager",
			contactDepartment: "Commercial Sales",
			email: "jmartinez@officefurniture.com",
			phone: "+1-555-0104",
			mobile: "+1-555-9904",
			address: "234 Commerce St, Chicago, IL 60601",
			notes: "Commercial furniture supplier, bulk discount available",
			isDeleted: false,
		},
		{
			id: "607f1f77bcf86cd799439055",
			vendorId: "V005",
			name: "CloudHost Services",
			contactPerson: "Robert Taylor",
			contactDesignation: "Solutions Architect",
			contactDepartment: "Cloud Services",
			email: "robert.t@cloudhost.com",
			phone: "+1-555-0105",
			mobile: "+1-555-9905",
			address: "456 Cloud Avenue, Seattle, WA 98101",
			notes: "Cloud infrastructure and hosting services",
			isDeleted: false,
		},
		{
			id: "607f1f77bcf86cd799439056",
			vendorId: "V006",
			name: "Security First Technologies",
			contactPerson: "Amanda Lee",
			contactDesignation: "VP of Sales",
			contactDepartment: "Sales",
			email: "a.lee@securityfirst.com",
			phone: "+1-555-0106",
			mobile: "+1-555-9906",
			address: "789 Security Blvd, Washington, DC 20001",
			notes: "Cybersecurity solutions, firewalls, and security audits",
			isDeleted: false,
		},
		{
			id: "607f1f77bcf86cd799439057",
			vendorId: "V007",
			name: "Mobile Devices International",
			contactPerson: "James Wilson",
			contactDesignation: "Enterprise Account Executive",
			contactDepartment: "Enterprise Sales",
			email: "jwilson@mobiledevices.com",
			phone: "+1-555-0107",
			mobile: "+1-555-9907",
			address: "321 Mobile Way, San Francisco, CA 94102",
			notes: "Authorized Apple and Samsung dealer, enterprise accounts",
			isDeleted: false,
		},
		{
			id: "607f1f77bcf86cd799439058",
			vendorId: "V008",
			name: "Print Solutions Corp",
			contactPerson: "Lisa Anderson",
			contactDesignation: "Sales Representative",
			contactDepartment: "Sales",
			email: "l.anderson@printsolutions.com",
			phone: "+1-555-0108",
			mobile: "+1-555-9908",
			address: "654 Print Lane, Dallas, TX 75201",
			notes: "Commercial printing equipment and supplies",
			isDeleted: false,
		},
		{
			id: "607f1f77bcf86cd799439059",
			vendorId: "V009",
			name: "AV Systems Pro",
			contactPerson: "Kevin Brown",
			contactDesignation: "Project Manager",
			contactDepartment: "AV Solutions",
			email: "k.brown@avsystems.com",
			phone: "+1-555-0109",
			mobile: "+1-555-9909",
			address: "987 Audio Visual Rd, Los Angeles, CA 90001",
			notes: "Audio/visual equipment for conference rooms",
			isDeleted: false,
		},
		{
			id: "607f1f77bcf86cd799439060",
			vendorId: "V010",
			name: "Server Hardware Solutions",
			contactPerson: "Patricia Garcia",
			contactDesignation: "Senior Account Manager",
			contactDepartment: "Enterprise Solutions",
			email: "p.garcia@serverhardware.com",
			phone: "+1-555-0110",
			mobile: "+1-555-9910",
			address: "147 Server Street, Denver, CO 80201",
			notes: "Enterprise server hardware, Dell and HP partner",
			isDeleted: false,
		},
		{
			id: "607f1f77bcf86cd799439061",
			vendorId: "V011",
			name: "IoT Innovations Inc.",
			contactPerson: "Christopher Davis",
			contactDesignation: "Business Development Manager",
			contactDepartment: "IoT Division",
			email: "c.davis@iotinnovations.com",
			phone: "+1-555-0111",
			mobile: "+1-555-9911",
			address: "258 IoT Boulevard, Portland, OR 97201",
			notes: "IoT sensors and smart building solutions",
			isDeleted: false,
		},
		{
			id: "607f1f77bcf86cd799439062",
			vendorId: "V012",
			name: "Data Center Equipment Ltd.",
			contactPerson: "Michelle Rodriguez",
			contactDesignation: "Technical Consultant",
			contactDepartment: "Data Center Solutions",
			email: "m.rodriguez@datacenter.com",
			phone: "+1-555-0112",
			mobile: "+1-555-9912",
			address: "369 Data Center Dr, Atlanta, GA 30301",
			notes: "Data center infrastructure, cooling, and power",
			isDeleted: false,
		},
		{
			id: "607f1f77bcf86cd799439063",
			vendorId: "V013",
			name: "Wireless Solutions Group",
			contactPerson: "Daniel Martinez",
			contactDesignation: "Wireless Solutions Specialist",
			contactDepartment: "Engineering",
			email: "d.martinez@wirelessgroup.com",
			phone: "+1-555-0113",
			mobile: "+1-555-9913",
			address: "741 Wireless Way, Miami, FL 33101",
			notes: "Wireless networking equipment and access points",
			isDeleted: false,
		},
		{
			id: "607f1f77bcf86cd799439064",
			vendorId: "V014",
			name: "Storage Systems Direct",
			contactPerson: "Karen Johnson",
			contactDesignation: "Storage Solutions Engineer",
			contactDepartment: "Technical Sales",
			email: "k.johnson@storagesystems.com",
			phone: "+1-555-0114",
			mobile: "+1-555-9914",
			address: "852 Storage Lane, Phoenix, AZ 85001",
			notes: "NAS, SAN, and backup solutions",
			isDeleted: false,
		},
		{
			id: "607f1f77bcf86cd799439065",
			vendorId: "V015",
			name: "Peripheral Devices Co.",
			contactPerson: "Thomas White",
			contactDesignation: "Product Specialist",
			contactDepartment: "Accessories Division",
			email: "t.white@peripherals.com",
			phone: "+1-555-0115",
			mobile: "+1-555-9915",
			address: "963 Peripheral Pkwy, Philadelphia, PA 19101",
			notes: "Keyboards, mice, webcams, and accessories",
			isDeleted: false,
		},
	];

	try {
		// Clear existing vendors
		console.log("🗑️  Clearing existing vendors...");
		await prisma.vendor.deleteMany({});
		console.log("   ✓ Vendors deleted");

		// Create vendors
		console.log("📝 Creating vendor records...");
		await prisma.vendor.createMany({
			data: vendorData.map((v, index) => {
				const orgId = orgIds[index % orgIds.length];
				return { ...v, workspaceId: orgId, organizationId: orgId };
			}),
		});

		console.log(`✅ Successfully created ${vendorData.length} vendor records`);

		// Display summary
		const withContactPerson = vendorData.filter((v) => v.contactPerson).length;
		const withEmail = vendorData.filter((v) => v.email).length;
		const withPhone = vendorData.filter((v) => v.phone).length;
		const withAddress = vendorData.filter((v) => v.address).length;

		console.log("\n📊 Vendor Summary:");
		console.log(`   👤 With Contact Person: ${withContactPerson}`);
		console.log(`   📧 With Email: ${withEmail}`);
		console.log(`   📞 With Phone: ${withPhone}`);
		console.log(`   📍 With Address: ${withAddress}`);
		console.log(`\n   📈 Total Vendors: ${vendorData.length}`);

		console.log("\n🎉 Vendor seeding completed successfully!");
	} catch (error) {
		console.error("❌ Error during vendor seeding:", error);
		throw error;
	}
}
