// // // // // // const axios = require("axios");
// // // // // // require("dotenv").config(); // Add this line to load .env file
// // // // // // // SAP B1 Service Layer Configuration
// // // // // // const SAP_CONFIG = {
// // // // // //   serviceLayerUrl:
// // // // // //     process.env.SAP_SERVICE_LAYER_URL || "https://your-sap-server:50000/b1s/v1",
// // // // // //   companyDB: process.env.COMPANY_DB || "YOUR_COMPANY_DB",
// // // // // //   username: process.env.USER_NAME || "manager",
// // // // // //   password: process.env.PASSWORD || "your_password",
// // // // // // };

// // // // // // let sessionId = null;

// // // // // // // Login to SAP B1 Service Layer
// // // // // // async function loginToSAP() {
// // // // // //   try {
// // // // // //     console.log("🔐 Logging in to SAP B1 Service Layer...");

// // // // // //     const loginData = {
// // // // // //       CompanyDB: SAP_CONFIG.companyDB,
// // // // // //       UserName: SAP_CONFIG.username,
// // // // // //       Password: SAP_CONFIG.password,
// // // // // //     };

// // // // // //     const response = await axios.post(
// // // // // //       `${SAP_CONFIG.serviceLayerUrl}/Login`,
// // // // // //       loginData,
// // // // // //       {
// // // // // //         headers: {
// // // // // //           "Content-Type": "application/json",
// // // // // //         },
// // // // // //       }
// // // // // //     );

// // // // // //     const cookies = response.headers["set-cookie"];
// // // // // //     const sessionCookie = cookies.find((cookie) =>
// // // // // //       cookie.includes("B1SESSION=")
// // // // // //     );
// // // // // //     sessionId = sessionCookie.split(";")[0].replace("B1SESSION=", "");

// // // // // //     console.log("✅ Successfully logged in to SAP B1 Service Layer");
// // // // // //     return sessionId;
// // // // // //   } catch (error) {
// // // // // //     console.error("❌ Error logging in to SAP B1:", error.message);
// // // // // //     throw error;
// // // // // //   }
// // // // // // }

// // // // // // // Test different customer configurations
// // // // // // async function testCustomerConfigurations() {
// // // // // //   try {
// // // // // //     if (!sessionId) {
// // // // // //       await loginToSAP();
// // // // // //     }

// // // // // //     console.log("🧪 Testing different customer configurations...\n");

// // // // // //     // Configuration 1: Minimal customer data
// // // // // //     const minimalCustomer = {
// // // // // //       CardCode: `TEST100`,
// // // // // //       CardName: "Test Customer Minimal",
// // // // // //       CardType: "cCustomer",
// // // // // //       GroupCode: 100,
// // // // // //     };

// // // // // //     console.log("📋 Test 1: Minimal Customer Configuration");
// // // // // //     console.log("Customer data:", JSON.stringify(minimalCustomer, null, 2));
// // // // // //     await testCustomerCreation(minimalCustomer, "Minimal");

// // // // // //     // Configuration 2: Basic customer with currency
// // // // // //     const basicCustomer = {
// // // // // //       CardCode: `TEST103`,
// // // // // //       CardName: "Test Customer Basic",
// // // // // //       CardType: "cCustomer",
// // // // // //       GroupCode: 100,
// // // // // //       Currency: "EUR",
// // // // // //     };

// // // // // //     console.log("\n📋 Test 2: Basic Customer with Currency");
// // // // // //     console.log("Customer data:", JSON.stringify(basicCustomer, null, 2));
// // // // // //     await testCustomerCreation(basicCustomer, "Basic");

// // // // // //     // Configuration 3: Customer without GroupCode
// // // // // //     const noGroupCustomer = {
// // // // // //       CardCode: `TEST104`,
// // // // // //       CardName: "Test Customer No Group",
// // // // // //       CardType: "cCustomer",
// // // // // //       Currency: "EUR",
// // // // // //     };

// // // // // //     console.log("\n📋 Test 3: Customer without GroupCode");
// // // // // //     console.log("Customer data:", JSON.stringify(noGroupCustomer, null, 2));
// // // // // //     await testCustomerCreation(noGroupCustomer, "No Group");

// // // // // //     // Configuration 4: Full customer data (like your current format)
// // // // // //     const fullCustomer = {
// // // // // //       CardCode: `TEST101`,
// // // // // //       CardName: "Test Customer Full",
// // // // // //       CardType: "cCustomer",
// // // // // //       GroupCode: 100,
// // // // // //       Currency: "EUR",
// // // // // //       EmailAddress: "test@example.com",
// // // // // //       Phone1: "1234567890",
// // // // // //       Valid: "tYES",
// // // // // //       Frozen: "tNO",
// // // // // //     };

// // // // // //     console.log("\n📋 Test 4: Full Customer Configuration");
// // // // // //     console.log("Customer data:", JSON.stringify(fullCustomer, null, 2));
// // // // // //     await testCustomerCreation(fullCustomer, "Full");
// // // // // //   } catch (error) {
// // // // // //     console.error("❌ Error in test configurations:", error.message);
// // // // // //   }
// // // // // // }

// // // // // // // Test individual customer creation
// // // // // // async function testCustomerCreation(customerData, testName) {
// // // // // //   try {
// // // // // //     const response = await axios.post(
// // // // // //       `${SAP_CONFIG.serviceLayerUrl}/BusinessPartners`,
// // // // // //       customerData,
// // // // // //       {
// // // // // //         headers: {
// // // // // //           "Content-Type": "application/json",
// // // // // //           Cookie: `B1SESSION=${sessionId}`,
// // // // // //         },
// // // // // //       }
// // // // // //     );

// // // // // //     console.log(`✅ SUCCESS: ${testName} configuration works!`);
// // // // // //     console.log(`Created customer: ${customerData.CardCode}`);

// // // // // //     // Clean up test customer
// // // // // //     try {
// // // // // //       await axios.delete(
// // // // // //         `${SAP_CONFIG.serviceLayerUrl}/BusinessPartners('${customerData.CardCode}')`,
// // // // // //         {
// // // // // //           headers: {
// // // // // //             Cookie: `B1SESSION=${sessionId}`,
// // // // // //           },
// // // // // //         }
// // // // // //       );
// // // // // //       console.log(`🧹 Test customer ${customerData.CardCode} cleaned up`);
// // // // // //     } catch (cleanupError) {
// // // // // //       console.log(
// // // // // //         `⚠️  Could not clean up test customer: ${cleanupError.message}`
// // // // // //       );
// // // // // //     }

// // // // // //     return true;
// // // // // //   } catch (error) {
// // // // // //     console.log(`❌ FAILED: ${testName} configuration`);
// // // // // //     console.log(`Error: ${error.message}`);

// // // // // //     if (error.response && error.response.data) {
// // // // // //       console.log(
// // // // // //         "Detailed error:",
// // // // // //         JSON.stringify(error.response.data, null, 2)
// // // // // //       );

// // // // // //       // Extract specific error details
// // // // // //       if (error.response.data.error && error.response.data.error.message) {
// // // // // //         console.log(
// // // // // //           `Specific error: ${error.response.data.error.message.value}`
// // // // // //         );
// // // // // //       }
// // // // // //     }
// // // // // //     console.log("-".repeat(50));
// // // // // //     return false;
// // // // // //   }
// // // // // // }

// // // // // // // Check SAP system configuration
// // // // // // async function checkSAPConfiguration() {
// // // // // //   try {
// // // // // //     if (!sessionId) {
// // // // // //       await loginToSAP();
// // // // // //     }

// // // // // //     console.log("🔧 Checking SAP System Configuration...\n");

// // // // // //     // Check currencies
// // // // // //     console.log("💰 Checking available currencies...");
// // // // // //     try {
// // // // // //       const currencyResponse = await axios.get(
// // // // // //         `${SAP_CONFIG.serviceLayerUrl}/Currencies?$top=5`,
// // // // // //         {
// // // // // //           headers: {
// // // // // //             "Content-Type": "application/json",
// // // // // //             Cookie: `B1SESSION=${sessionId}`,
// // // // // //           },
// // // // // //         }
// // // // // //       );

// // // // // //       if (currencyResponse.data && currencyResponse.data.value) {
// // // // // //         console.log("Available currencies:");
// // // // // //         currencyResponse.data.value.forEach((currency) => {
// // // // // //           console.log(`  - ${currency.Code}: ${currency.Name}`);
// // // // // //         });
// // // // // //       }
// // // // // //     } catch (error) {
// // // // // //       console.log("❌ Could not fetch currencies:", error.message);
// // // // // //     }

// // // // // //     // Check payment terms
// // // // // //     console.log("\n💳 Checking payment terms...");
// // // // // //     try {
// // // // // //       const paymentTermsResponse = await axios.get(
// // // // // //         `${SAP_CONFIG.serviceLayerUrl}/PaymentTermsTypes?$top=5`,
// // // // // //         {
// // // // // //           headers: {
// // // // // //             "Content-Type": "application/json",
// // // // // //             Cookie: `B1SESSION=${sessionId}`,
// // // // // //           },
// // // // // //         }
// // // // // //       );

// // // // // //       if (paymentTermsResponse.data && paymentTermsResponse.data.value) {
// // // // // //         console.log("Available payment terms:");
// // // // // //         paymentTermsResponse.data.value.forEach((term) => {
// // // // // //           console.log(
// // // // // //             `  - GroupNumber: ${term.GroupNumber}, Description: ${term.PaymentTermsGroupName}`
// // // // // //           );
// // // // // //         });
// // // // // //       }
// // // // // //     } catch (error) {
// // // // // //       console.log("❌ Could not fetch payment terms:", error.message);
// // // // // //     }

// // // // // //     // Check price lists
// // // // // //     console.log("\n💲 Checking price lists...");
// // // // // //     try {
// // // // // //       const priceListResponse = await axios.get(
// // // // // //         `${SAP_CONFIG.serviceLayerUrl}/PriceLists?$top=5`,
// // // // // //         {
// // // // // //           headers: {
// // // // // //             "Content-Type": "application/json",
// // // // // //             Cookie: `B1SESSION=${sessionId}`,
// // // // // //           },
// // // // // //         }
// // // // // //       );

// // // // // //       if (priceListResponse.data && priceListResponse.data.value) {
// // // // // //         console.log("Available price lists:");
// // // // // //         priceListResponse.data.value.forEach((priceList) => {
// // // // // //           console.log(
// // // // // //             `  - PriceListNo: ${priceList.PriceListNo}, Name: ${priceList.PriceListName}`
// // // // // //           );
// // // // // //         });
// // // // // //       }
// // // // // //     } catch (error) {
// // // // // //       console.log("❌ Could not fetch price lists:", error.message);
// // // // // //     }
// // // // // //   } catch (error) {
// // // // // //     console.error("❌ Error checking SAP configuration:", error.message);
// // // // // //   }
// // // // // // }

// // // // // // // Main diagnostic function
// // // // // // async function runDetailedDiagnostics() {
// // // // // //   try {
// // // // // //     console.log("🔍 Detailed SAP B1 Customer Integration Diagnostics");
// // // // // //     console.log("=".repeat(60));

// // // // // //     await checkSAPConfiguration();
// // // // // //     console.log("\n" + "=".repeat(60));
// // // // // //     await testCustomerConfigurations();

// // // // // //     console.log("\n✅ Detailed diagnostics completed!");
// // // // // //   } catch (error) {
// // // // // //     console.error("❌ Detailed diagnostics failed:", error.message);
// // // // // //   }
// // // // // // }

// // // // // // // Run detailed diagnostics
// // // // // // runDetailedDiagnostics();
// // // // // const axios = require("axios");
// // // // // require("dotenv").config();
// // // // // // Debug SAP currencies and exchange rates
// // // // // async function debugSAPCurrencies() {
// // // // //   try {
// // // // //     console.log("🔍 Debugging SAP B1 Currencies and Exchange Rates");
// // // // //     console.log("=".repeat(60));

// // // // //     // SAP B1 Service Layer Configuration
// // // // //     const SAP_CONFIG = {
// // // // //       serviceLayerUrl: process.env.SAP_SERVICE_LAYER_URL,
// // // // //       companyDB: process.env.COMPANY_DB,
// // // // //       username: process.env.USER_NAME,
// // // // //       password: process.env.PASSWORD,
// // // // //     };

// // // // //     // Login to SAP
// // // // //     console.log("🔐 Logging in to SAP B1...");
// // // // //     const loginResponse = await axios.post(
// // // // //       `${SAP_CONFIG.serviceLayerUrl}/Login`,
// // // // //       {
// // // // //         CompanyDB: SAP_CONFIG.companyDB,
// // // // //         UserName: SAP_CONFIG.username,
// // // // //         Password: SAP_CONFIG.password,
// // // // //       }
// // // // //     );

// // // // //     const cookies = loginResponse.headers["set-cookie"];
// // // // //     const sessionCookie = cookies.find((cookie) =>
// // // // //       cookie.includes("B1SESSION=")
// // // // //     );
// // // // //     const sessionId = sessionCookie.split(";")[0].replace("B1SESSION=", "");

// // // // //     console.log("✅ Successfully logged in to SAP B1");

// // // // //     // Check company info
// // // // //     console.log("\n💼 Checking company information...");
// // // // //     try {
// // // // //       const companyResponse = await axios.get(
// // // // //         `${SAP_CONFIG.serviceLayerUrl}/CompanyService_GetCompanyInfo`,
// // // // //         {
// // // // //           headers: {
// // // // //             Cookie: `B1SESSION=${sessionId}`,
// // // // //           },
// // // // //         }
// // // // //       );
// // // // //       console.log("Company Currency:", companyResponse.data.LocalCurrency);
// // // // //       console.log("Company Name:", companyResponse.data.CompanyName);
// // // // //     } catch (error) {
// // // // //       console.log("Could not fetch company info:", error.message);
// // // // //     }

// // // // //     // Check available currencies
// // // // //     console.log("\n💰 Checking available currencies...");
// // // // //     try {
// // // // //       const currencyResponse = await axios.get(
// // // // //         `${SAP_CONFIG.serviceLayerUrl}/Currencies`,
// // // // //         {
// // // // //           headers: {
// // // // //             Cookie: `B1SESSION=${sessionId}`,
// // // // //           },
// // // // //         }
// // // // //       );

// // // // //       if (currencyResponse.data && currencyResponse.data.value) {
// // // // //         console.log("Available currencies:");
// // // // //         currencyResponse.data.value.forEach((currency) => {
// // // // //           console.log(`  - ${currency.Code}: ${currency.Name}`);
// // // // //         });

// // // // //         // Check if EUR exists
// // // // //         const eurCurrency = currencyResponse.data.value.find(
// // // // //           (c) => c.Code === "EUR"
// // // // //         );
// // // // //         if (eurCurrency) {
// // // // //           console.log("\n✅ EUR currency found in system");
// // // // //         } else {
// // // // //           console.log("\n❌ EUR currency NOT found in system");
// // // // //         }
// // // // //       }
// // // // //     } catch (error) {
// // // // //       console.log("Could not fetch currencies:", error.message);
// // // // //     }

// // // // //     // Check exchange rates
// // // // //     console.log("\n📈 Checking exchange rates...");
// // // // //     try {
// // // // //       const exchangeRateResponse = await axios.get(
// // // // //         `${SAP_CONFIG.serviceLayerUrl}/SBOExchangeRates`,
// // // // //         {
// // // // //           headers: {
// // // // //             Cookie: `B1SESSION=${sessionId}`,
// // // // //           },
// // // // //         }
// // // // //       );

// // // // //       if (exchangeRateResponse.data && exchangeRateResponse.data.value) {
// // // // //         console.log("Exchange rates:");
// // // // //         exchangeRateResponse.data.value.forEach((rate) => {
// // // // //           console.log(
// // // // //             `  - ${rate.Currency}: Rate = ${rate.Rate}, Date = ${rate.RateDate}`
// // // // //           );
// // // // //         });
// // // // //       }
// // // // //     } catch (error) {
// // // // //       console.log("Could not fetch exchange rates:", error.message);
// // // // //     }

// // // // //     // Test creating a simple order without currency
// // // // //     console.log("\n🧪 Testing simple order creation without currency...");
// // // // //     const simpleOrder = {
// // // // //       CardCode: "C0001",
// // // // //       DocDate: new Date().toISOString().split("T")[0], // YYYY-MM-DD format
// // // // //       DocumentLines: [
// // // // //         {
// // // // //           ItemCode: "ai-services",
// // // // //           Quantity: 1,
// // // // //           UnitPrice: 5000,
// // // // //         },
// // // // //       ],
// // // // //     };

// // // // //     try {
// // // // //       const orderResponse = await axios.post(
// // // // //         `${SAP_CONFIG.serviceLayerUrl}/Orders`,
// // // // //         simpleOrder,
// // // // //         {
// // // // //           headers: {
// // // // //             "Content-Type": "application/json",
// // // // //             Cookie: `B1SESSION=${sessionId}`,
// // // // //           },
// // // // //         }
// // // // //       );

// // // // //       console.log("✅ Simple order created successfully!");
// // // // //       console.log("DocEntry:", orderResponse.data.DocEntry);

// // // // //       // Clean up - delete the test order
// // // // //       try {
// // // // //         await axios.delete(
// // // // //           `${SAP_CONFIG.serviceLayerUrl}/Orders(${orderResponse.data.DocEntry})`,
// // // // //           {
// // // // //             headers: {
// // // // //               Cookie: `B1SESSION=${sessionId}`,
// // // // //             },
// // // // //           }
// // // // //         );
// // // // //         console.log("🧹 Test order cleaned up");
// // // // //       } catch (cleanupError) {
// // // // //         console.log("Could not clean up test order:", cleanupError.message);
// // // // //       }
// // // // //     } catch (orderError) {
// // // // //       console.log("❌ Simple order creation failed:");
// // // // //       if (orderError.response && orderError.response.data) {
// // // // //         console.log(JSON.stringify(orderError.response.data, null, 2));
// // // // //       }
// // // // //     }

// // // // //     console.log("\n✅ Currency debugging completed!");
// // // // //   } catch (error) {
// // // // //     console.error("❌ Currency debugging failed:", error.message);
// // // // //     if (error.response && error.response.data) {
// // // // //       console.error(
// // // // //         "Response data:",
// // // // //         JSON.stringify(error.response.data, null, 2)
// // // // //       );
// // // // //     }
// // // // //   }
// // // // // }

// // // // // // Run the debug
// // // // // debugSAPCurrencies();
// // // // // Test script to debug SAP order creation issues
// // // // const {
// // // //   loginToSAP,
// // // //   checkBusinessPartnerExists,
// // // //   formatOrderForSAP,
// // // //   createSalesOrderInSAP,
// // // //   getSystemLocalCurrency,
// // // // } = require("./sapB1Integration");

// // // // async function testOrderCreation() {
// // // //   try {
// // // //     console.log("🧪 Testing SAP Order Creation...");
// // // //     console.log("=".repeat(50));

// // // //     // Test login
// // // //     console.log("1. Testing SAP Login...");
// // // //     await loginToSAP();

// // // //     // Test system currency
// // // //     console.log("\n2. Getting system currency...");
// // // //     const systemCurrency = await getSystemLocalCurrency();
// // // //     console.log(`System currency: ${systemCurrency}`);

// // // //     // Test business partner
// // // //     console.log("\n3. Testing business partner...");
// // // //     const bpExists = await checkBusinessPartnerExists("C0001");
// // // //     console.log(`Business partner C0001 exists: ${bpExists}`);

// // // //     // Test order formatting and creation
// // // //     console.log("\n4. Testing order creation...");

// // // //     const testOrder = {
// // // //       DocEntry: 999,
// // // //       CardCode: "C0001",
// // // //       CardName: "Angelina",
// // // //       DocDate: new Date().toISOString(),
// // // //       DocDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
// // // //       Comments: "Test order - debugging",
// // // //       DocumentLines: [
// // // //         {
// // // //           ItemCode: "consultation",
// // // //           ItemDescription: "Test consultation service",
// // // //           Quantity: 1,
// // // //           Price: 100,
// // // //           UnitPrice: 100,
// // // //         },
// // // //       ],
// // // //       DocTotal: 100,
// // // //       salesAgent: "test-agent-id",
// // // //     };

// // // //     // Test different formatting strategies
// // // //     console.log("\n5. Testing different order formats...");

// // // //     // Strategy 1: No currency
// // // //     console.log("\n--- Strategy 1: No Currency ---");
// // // //     try {
// // // //       const orderNoCurrency = {
// // // //         CardCode: testOrder.CardCode,
// // // //         DocDate: new Date().toISOString().split("T")[0],
// // // //         DocDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
// // // //           .toISOString()
// // // //           .split("T")[0],
// // // //         Comments: testOrder.Comments,
// // // //         DocumentLines: [
// // // //           {
// // // //             ItemCode: "consultation",
// // // //             Quantity: 1,
// // // //             Price: 100,
// // // //             ItemDescription: "Test consultation service",
// // // //             LineNum: 0,
// // // //           },
// // // //         ],
// // // //       };

// // // //       console.log(
// // // //         "Order data (no currency):",
// // // //         JSON.stringify(orderNoCurrency, null, 2)
// // // //       );
// // // //       const result1 = await createSalesOrderInSAP(orderNoCurrency);
// // // //       console.log("✅ Strategy 1 SUCCESS:", result1.DocEntry);
// // // //       return result1;
// // // //     } catch (error) {
// // // //       console.log("❌ Strategy 1 FAILED:", error.message);
// // // //     }

// // // //     // Strategy 2: With system currency
// // // //     console.log("\n--- Strategy 2: System Currency ---");
// // // //     try {
// // // //       const orderWithSystemCurrency = {
// // // //         CardCode: testOrder.CardCode,
// // // //         DocDate: new Date().toISOString().split("T")[0],
// // // //         DocDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
// // // //           .toISOString()
// // // //           .split("T")[0],
// // // //         Comments: testOrder.Comments,
// // // //         DocCurrency: systemCurrency,
// // // //         DocumentLines: [
// // // //           {
// // // //             ItemCode: "consultation",
// // // //             Quantity: 1,
// // // //             Price: 100,
// // // //             ItemDescription: "Test consultation service",
// // // //             LineNum: 0,
// // // //             Currency: systemCurrency,
// // // //           },
// // // //         ],
// // // //       };

// // // //       console.log(
// // // //         "Order data (system currency):",
// // // //         JSON.stringify(orderWithSystemCurrency, null, 2)
// // // //       );
// // // //       const result2 = await createSalesOrderInSAP(orderWithSystemCurrency);
// // // //       console.log("✅ Strategy 2 SUCCESS:", result2.DocEntry);
// // // //       return result2;
// // // //     } catch (error) {
// // // //       console.log("❌ Strategy 2 FAILED:", error.message);
// // // //     }

// // // //     // Strategy 3: EUR with rate
// // // //     console.log("\n--- Strategy 3: EUR with Rate ---");
// // // //     try {
// // // //       const orderWithEUR = {
// // // //         CardCode: testOrder.CardCode,
// // // //         DocDate: new Date().toISOString().split("T")[0],
// // // //         DocDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
// // // //           .toISOString()
// // // //           .split("T")[0],
// // // //         Comments: testOrder.Comments,
// // // //         DocCurrency: "EUR",
// // // //         DocRate: 1.0,
// // // //         DocumentLines: [
// // // //           {
// // // //             ItemCode: "consultation",
// // // //             Quantity: 1,
// // // //             Price: 100,
// // // //             ItemDescription: "Test consultation service",
// // // //             LineNum: 0,
// // // //             Currency: "EUR",
// // // //             Rate: 1.0,
// // // //           },
// // // //         ],
// // // //       };

// // // //       console.log(
// // // //         "Order data (EUR with rate):",
// // // //         JSON.stringify(orderWithEUR, null, 2)
// // // //       );
// // // //       const result3 = await createSalesOrderInSAP(orderWithEUR);
// // // //       console.log("✅ Strategy 3 SUCCESS:", result3.DocEntry);
// // // //       return result3;
// // // //     } catch (error) {
// // // //       console.log("❌ Strategy 3 FAILED:", error.message);
// // // //     }

// // // //     console.log("\n❌ All strategies failed!");
// // // //   } catch (error) {
// // // //     console.error("❌ Test failed:", error.message);
// // // //   }
// // // // }

// // // // // Run the test
// // // // if (require.main === module) {
// // // //   testOrderCreation().catch(console.error);
// // // // }

// // // // module.exports = { testOrderCreation };
// // // // Script to setup exchange rates in SAP B1
// // // const {
// // //   checkAndSetupExchangeRates,
// // //   getCompanyCurrencyInfo,
// // // } = require("../utils/sapB1Integration");

// // // async function setupExchangeRates() {
// // //   try {
// // //     console.log("🔧 Setting up exchange rates in SAP B1...");

// // //     // Get current currency information
// // //     const currencyInfo = await getCompanyCurrencyInfo();
// // //     console.log("Current currency info:", currencyInfo);

// // //     // Setup exchange rates
// // //     await checkAndSetupExchangeRates();

// // //     console.log("✅ Exchange rates setup completed");
// // //   } catch (error) {
// // //     console.error("❌ Error setting up exchange rates:", error);
// // //   }
// // // }

// // // // Run the setup
// // // setupExchangeRates();
// // // Script to setup exchange rates in SAP B1
// // const {
// //   checkAndSetupExchangeRates,
// //   getCompanyCurrencyInfo,
// // } = require("./sapB1Integration");

// // async function setupExchangeRates() {
// //   try {
// //     console.log("🔧 Setting up exchange rates in SAP B1...");

// //     // Get current currency information
// //     const currencyInfo = await getCompanyCurrencyInfo();
// //     console.log("Current currency info:", currencyInfo);

// //     // Setup exchange rates
// //     await checkAndSetupExchangeRates();

// //     console.log("✅ Exchange rates setup completed");
// //   } catch (error) {
// //     console.error("❌ Error setting up exchange rates:", error);
// //   }
// // }

// // // Run the setup
// // setupExchangeRates();
// // Script to test SAP currency configuration
// const {
//   getCompanyCurrencyInfo,
//   testSAPConnection,
// } = require("../utils/sapB1Integration");

// async function testSAPCurrency() {
//   try {
//     console.log("🧪 Testing SAP currency configuration...");

//     // Test connection
//     const connectionResult = await testSAPConnection();
//     console.log("Connection result:", connectionResult);

//     // Get currency info
//     const currencyInfo = await getCompanyCurrencyInfo();
//     console.log("Currency info:", currencyInfo);

//     if (currencyInfo.exchangeRates.AED) {
//       console.log(
//         "✅ AED exchange rate found:",
//         currencyInfo.exchangeRates.AED
//       );
//     } else {
//       console.log("⚠️ AED exchange rate not found");
//       console.log(
//         "Available currencies:",
//         Object.keys(currencyInfo.exchangeRates)
//       );
//     }

//     console.log("✅ Currency test completed");
//   } catch (error) {
//     console.error("❌ Error testing currency:", error);
//   }
// }

// // Run the test
// testSAPCurrency();
// Comprehensive script to diagnose and fix currency issues
const { getSessionId } = require("../utils/sapB1Integration");
const axios = require("axios");

const SAP_CONFIG = {
  serviceLayerUrl: process.env.SAP_SERVICE_LAYER_URL,
  companyDB: process.env.COMPANY_DB,
  username: process.env.USER_NAME,
  password: process.env.PASSWORD,
};

async function comprehensiveCurrencyDiagnosis() {
  try {
    console.log("🔍 COMPREHENSIVE CURRENCY DIAGNOSIS");
    console.log("=====================================");

    const sessionId = await getSessionId();

    // 1. Check Business Partner Currency
    const cardCode = "C0001";
    console.log(`\n1. 👤 BUSINESS PARTNER ${cardCode} ANALYSIS:`);
    console.log("-------------------------------------------");

    try {
      const bpResponse = await axios.get(
        `${SAP_CONFIG.serviceLayerUrl}/BusinessPartners('${cardCode}')`,
        {
          headers: {
            "Content-Type": "application/json",
            Cookie: `B1SESSION=${sessionId}`,
          },
        }
      );

      const bp = bpResponse.data;
      console.log("✅ Business Partner Found:");
      console.log(`   Name: ${bp.CardName}`);
      console.log(`   Currency: ${bp.Currency || "NOT SET"}`);
      console.log(`   Price List: ${bp.PriceListNum || "NOT SET"}`);
      console.log(`   Group: ${bp.GroupCode || "NOT SET"}`);
      console.log(`   Valid: ${bp.Valid}`);
      console.log(`   Frozen: ${bp.Frozen}`);

      if (bp.Currency === "EUR") {
        console.log(
          "🚨 PROBLEM FOUND: Business Partner is set to EUR currency!"
        );
        console.log("   This is likely causing the exchange rate error.");
      }

      if (bp.PriceListNum && bp.PriceListNum !== 1) {
        console.log(
          `🚨 PROBLEM FOUND: Business Partner uses Price List ${bp.PriceListNum}`
        );
        console.log("   This might override our Price List 1 setting.");
      }
    } catch (bpError) {
      console.log("❌ Could not get Business Partner:", bpError.message);
    }

    // 2. Check Item Currency Configuration
    const itemCode = "1002";
    console.log(`\n2. 📦 ITEM ${itemCode} ANALYSIS:`);
    console.log("--------------------------------");

    try {
      const itemResponse = await axios.get(
        `${SAP_CONFIG.serviceLayerUrl}/Items('${itemCode}')`,
        {
          headers: {
            "Content-Type": "application/json",
            Cookie: `B1SESSION=${sessionId}`,
          },
        }
      );

      const item = itemResponse.data;
      console.log("✅ Item Found:");
      console.log(`   Name: ${item.ItemName}`);
      console.log(`   Currency: ${item.Currency || "NOT SET"}`);
      console.log(`   Valid: ${item.Valid}`);
      console.log(`   Sales Item: ${item.SalesItem}`);

      if (item.Currency === "EUR") {
        console.log("🚨 PROBLEM FOUND: Item is set to EUR currency!");
      }

      console.log("\n   Price Lists for this item:");
      if (item.ItemPrices && item.ItemPrices.length > 0) {
        item.ItemPrices.forEach((price) => {
          const status =
            price.Currency === "EUR"
              ? "🚨 EUR"
              : price.Currency === "AED"
              ? "✅ AED"
              : "⚠️ OTHER";
          console.log(
            `   Price List ${price.PriceList}: ${price.Price} ${
              price.Currency || "base"
            } ${status}`
          );
        });
      }
    } catch (itemError) {
      console.log("❌ Could not get Item:", itemError.message);
    }

    // 3. Check Price List 1 Configuration
    console.log(`\n3. 💰 PRICE LIST 1 ANALYSIS:`);
    console.log("-----------------------------");

    try {
      const priceListResponse = await axios.get(
        `${SAP_CONFIG.serviceLayerUrl}/PriceLists(1)`,
        {
          headers: {
            "Content-Type": "application/json",
            Cookie: `B1SESSION=${sessionId}`,
          },
        }
      );

      const priceList = priceListResponse.data;
      console.log("✅ Price List 1 Found:");
      console.log(`   Name: ${priceList.PriceListName}`);
      console.log(`   Base Price List: ${priceList.BasePriceList}`);
      console.log(`   Valid From: ${priceList.ValidFrom || "Not set"}`);
      console.log(`   Valid To: ${priceList.ValidTo || "Not set"}`);
      console.log(`   Active: ${priceList.Active}`);
    } catch (plError) {
      console.log("❌ Could not get Price List 1:", plError.message);
    }

    // 4. Check Company Currency
    console.log(`\n4. 🏢 COMPANY CURRENCY ANALYSIS:`);
    console.log("--------------------------------");

    try {
      const currenciesResponse = await axios.get(
        `${SAP_CONFIG.serviceLayerUrl}/Currencies`,
        {
          headers: {
            "Content-Type": "application/json",
            Cookie: `B1SESSION=${sessionId}`,
          },
        }
      );

      if (currenciesResponse.data && currenciesResponse.data.value) {
        console.log("Available currencies:");
        currenciesResponse.data.value.forEach((currency) => {
          const isDefault = currency.Default === "tYES" ? "✅ DEFAULT" : "";
          console.log(
            `   ${currency.Code}: ${currency.CurrencyName} (Rate: ${currency.Rate}) ${isDefault}`
          );
        });

        const defaultCurrency = currenciesResponse.data.value.find(
          (c) => c.Default === "tYES"
        );
        if (defaultCurrency) {
          console.log(`\n✅ Company Default Currency: ${defaultCurrency.Code}`);
          if (defaultCurrency.Code !== "AED") {
            console.log("🚨 PROBLEM: Company default currency is not AED!");
          }
        }
      }
    } catch (currencyError) {
      console.log("❌ Could not get currencies:", currencyError.message);
    }

    // 5. Generate Recommendations
    console.log(`\n5. 🔧 RECOMMENDATIONS:`);
    console.log("======================");
    console.log("Based on the analysis above, here are the likely fixes:");
    console.log("");
    console.log("1. If Business Partner Currency = EUR:");
    console.log("   → Change Business Partner currency to AED or leave blank");
    console.log("");
    console.log("2. If Business Partner Price List ≠ 1:");
    console.log("   → Change Business Partner price list to 1 or leave blank");
    console.log("");
    console.log("3. If Item Currency = EUR:");
    console.log("   → Change Item currency to AED or leave blank");
    console.log("");
    console.log("4. If Company Default Currency ≠ AED:");
    console.log("   → Set AED as the company default currency");
    console.log("");
    console.log(
      "5. Alternative: Create order without currency/price list fields"
    );
  } catch (error) {
    console.error("❌ Error during diagnosis:", error);
  }
}

// Run the comprehensive diagnosis
comprehensiveCurrencyDiagnosis();
