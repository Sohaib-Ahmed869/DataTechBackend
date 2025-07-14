// const axios = require("axios");
// const dotenv = require("dotenv");

// // Load environment variables
// dotenv.config();

// // SAP B1 Service Layer Configuration
// const SAP_CONFIG = {
//   serviceLayerUrl: process.env.SAP_SERVICE_LAYER_URL,
//   companyDB: process.env.COMPANY_DB,
//   username: process.env.USER_NAME,
//   password: process.env.PASSWORD,
// };

// // Set this to true to enable automatic SAP sync
// const ENABLE_SAP_SYNC = true;

// // Session management
// let sessionId = null;
// let sessionTimeout = null;

// // In-memory lock to prevent concurrent CardCode generation
// let cardCodeGenerationLock = false;
// const cardCodeQueue = [];

// // Login to SAP B1 Service Layer and get session ID
// async function loginToSAP() {
//   try {
//     console.log("Logging in to SAP B1 Service Layer...");
//     if (sessionTimeout) {
//       clearTimeout(sessionTimeout);
//     }

//     const loginData = {
//       CompanyDB: SAP_CONFIG.companyDB,
//       UserName: SAP_CONFIG.username,
//       Password: SAP_CONFIG.password,
//     };

//     const response = await axios.post(
//       `${SAP_CONFIG.serviceLayerUrl}/Login`,
//       loginData,
//       {
//         headers: {
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     const cookies = response.headers["set-cookie"];
//     if (!cookies) {
//       throw new Error("No cookies returned from SAP B1 login");
//     }

//     const sessionCookie = cookies.find((cookie) =>
//       cookie.includes("B1SESSION=")
//     );
//     if (!sessionCookie) {
//       throw new Error("B1SESSION cookie not found");
//     }

//     sessionId = sessionCookie.split(";")[0].replace("B1SESSION=", "");

//     // Set session timeout (25 minutes)
//     sessionTimeout = setTimeout(() => {
//       sessionId = null;
//     }, 25 * 60 * 1000);

//     console.log("Successfully logged in to SAP B1 Service Layer");
//     return sessionId;
//   } catch (error) {
//     console.error("Error logging in to SAP B1:", error.message);
//     if (error.response) {
//       console.error("SAP Error details:", error.response.data);
//     }
//     throw new Error(`SAP Login Error: ${error.message}`);
//   }
// }

// // Get a valid session ID (login if necessary)
// async function getSessionId() {
//   if (!sessionId) {
//     return await loginToSAP();
//   }
//   return sessionId;
// }

// // Helper function to wait for lock release
// function waitForLock() {
//   return new Promise((resolve) => {
//     if (!cardCodeGenerationLock) {
//       resolve();
//     } else {
//       cardCodeQueue.push(resolve);
//     }
//   });
// }

// // Helper function to release lock
// function releaseLock() {
//   cardCodeGenerationLock = false;
//   if (cardCodeQueue.length > 0) {
//     const nextResolve = cardCodeQueue.shift();
//     nextResolve();
//   }
// }

// // Get highest CardCode from both SAP and local database
// async function getHighestCardCode() {
//   let highestFromSAP = 0;
//   let highestFromLocal = 0;

//   // Try to get highest from SAP
//   try {
//     const sessionId = await getSessionId();
//     console.log("🔍 Checking SAP for highest C#### CardCode...");

//     // Get multiple customers to ensure we find the highest
//     const response = await axios.get(
//       `${SAP_CONFIG.serviceLayerUrl}/BusinessPartners?$top=50&$orderby=CardCode desc&$filter=CardType eq 'cCustomer' and startswith(CardCode,'C') and length(CardCode) eq 5`,
//       {
//         headers: {
//           "Content-Type": "application/json",
//           Cookie: `B1SESSION=${sessionId}`,
//         },
//       }
//     );

//     if (
//       response.data &&
//       response.data.value &&
//       response.data.value.length > 0
//     ) {
//       // Find the highest numeric CardCode
//       for (const customer of response.data.value) {
//         const match = customer.CardCode.match(/^C(\d{4})$/);
//         if (match) {
//           const number = Number.parseInt(match[1], 10);
//           if (number > highestFromSAP) {
//             highestFromSAP = number;
//           }
//         }
//       }
//       console.log(`📊 Highest SAP CardCode number: ${highestFromSAP}`);
//     }
//   } catch (sapError) {
//     console.warn("⚠️ Could not fetch from SAP:", sapError.message);
//   }

//   // Try to get highest from local database
//   try {
//     const Customer = require("../models/Customer.model");
//     console.log("🔍 Checking local database for highest C#### CardCode...");

//     const customers = await Customer.find({
//       CardCode: { $regex: /^C\d{4}$/ },
//     })
//       .sort({ CardCode: -1 })
//       .limit(50)
//       .lean();

//     for (const customer of customers) {
//       const match = customer.CardCode.match(/^C(\d{4})$/);
//       if (match) {
//         const number = Number.parseInt(match[1], 10);
//         if (number > highestFromLocal) {
//           highestFromLocal = number;
//         }
//       }
//     }
//     console.log(`📊 Highest local CardCode number: ${highestFromLocal}`);
//   } catch (localError) {
//     console.warn("⚠️ Could not fetch from local database:", localError.message);
//   }

//   // Return the highest number found
//   const highest = Math.max(highestFromSAP, highestFromLocal);
//   console.log(`🎯 Overall highest CardCode number: ${highest}`);
//   return highest;
// }

// // Generate next CardCode with proper locking and checking
// exports.generateNextCardCode = async () => {
//   // Wait for any existing generation to complete
//   await waitForLock();

//   // Acquire lock
//   cardCodeGenerationLock = true;

//   try {
//     console.log("🔄 Generating next CardCode with comprehensive checking...");

//     // Get the highest existing CardCode number
//     const highestNumber = await getHighestCardCode();

//     // Generate next CardCode
//     const nextNumber = highestNumber + 1;
//     const nextCardCode = `C${nextNumber.toString().padStart(4, "0")}`;

//     console.log(`✅ Generated next CardCode: ${nextCardCode}`);

//     // Double-check that this CardCode doesn't exist
//     const exists = await exports.checkCustomerExistsInSAP(nextCardCode);
//     if (exists) {
//       console.log(`⚠️ CardCode ${nextCardCode} already exists, trying next...`);
//       // If it exists, try the next one
//       const fallbackCardCode = `C${(nextNumber + 1)
//         .toString()
//         .padStart(4, "0")}`;
//       console.log(`🔄 Using fallback CardCode: ${fallbackCardCode}`);
//       return fallbackCardCode;
//     }

//     return nextCardCode;
//   } catch (error) {
//     console.error("❌ Error generating CardCode:", error);
//     // Fallback to timestamp-based generation
//     const timestamp = Date.now().toString().slice(-4);
//     const fallbackCardCode = `C${timestamp}`;
//     console.log(`🆘 Using timestamp fallback: ${fallbackCardCode}`);
//     return fallbackCardCode;
//   } finally {
//     // Always release the lock
//     releaseLock();
//   }
// };

// // Format customer data for SAP B1 - WORKING VERSION based on your diagnostics
// exports.formatCustomerForSAP = async (customer) => {
//   // Based on your successful tests, this is the working format:
//   const sapCustomer = {
//     CardCode: customer.CardCode || "",
//     CardName: customer.CardName,
//     CardType: "cCustomer",
//     GroupCode: 100, // This exists in your system and works
//     Currency: "AED", // This works in your system
//   };

//   // Add optional fields only if they have values
//   if (customer.Email) {
//     sapCustomer.EmailAddress = customer.Email;
//   }

//   if (customer.phoneNumber) {
//     sapCustomer.Phone1 = customer.phoneNumber;
//   }

//   // Add additional phone number if available
//   if (
//     customer.additionalPhoneNumbers &&
//     customer.additionalPhoneNumbers.length > 0
//   ) {
//     sapCustomer.Phone2 = customer.additionalPhoneNumbers[0];
//   }

//   // Add notes if available
//   if (customer.notes) {
//     sapCustomer.Notes = customer.notes;
//   }

//   // Add status fields
//   sapCustomer.Valid = "tYES";
//   sapCustomer.Frozen = "tNO";

//   // Add contact persons if we have detailed contact info
//   if (customer.firstName || customer.lastName) {
//     sapCustomer.ContactEmployees = [
//       {
//         Name: `${customer.firstName || ""} ${customer.lastName || ""}`.trim(),
//         Phone1: customer.phoneNumber || "",
//         E_Mail: customer.Email || "",
//         Active: "tYES",
//       },
//     ];
//   }

//   // Add addresses array if address exists
//   if (customer.address && (customer.address.street || customer.address.city)) {
//     sapCustomer.BPAddresses = [
//       {
//         AddressName: "Bill To",
//         AddressType: "bo_BillTo",
//         Street: customer.address.street || "",
//         ZipCode: customer.address.zipCode || "",
//         City: customer.address.city || "",
//         Country: "FR",
//       },
//       {
//         AddressName: "Ship To",
//         AddressType: "bo_ShipTo",
//         Street: customer.address.street || "",
//         ZipCode: customer.address.zipCode || "",
//         City: customer.address.city || "",
//         Country: "FR",
//       },
//     ];
//   }

//   console.log("✅ Formatted customer for SAP (working configuration):", {
//     CardCode: sapCustomer.CardCode,
//     CardName: sapCustomer.CardName,
//     CardType: sapCustomer.CardType,
//     GroupCode: sapCustomer.GroupCode,
//     Currency: sapCustomer.Currency,
//     EmailAddress: sapCustomer.EmailAddress || "Not provided",
//     Phone1: sapCustomer.Phone1 || "Not provided",
//   });

//   return sapCustomer;
// };

// // Create a customer in SAP B1 with enhanced error handling
// exports.createCustomerInSAP = async (customerData) => {
//   try {
//     if (!ENABLE_SAP_SYNC) {
//       console.log("SAP sync is disabled. Skipping customer creation in SAP.");
//       return {
//         simulated: true,
//         message: "SAP sync is disabled",
//         CardCode: customerData.CardCode,
//       };
//     }

//     const sessionId = await getSessionId();
//     console.log("Creating customer in SAP B1...");
//     console.log(
//       "📋 Customer data being sent to SAP:",
//       JSON.stringify(customerData, null, 2)
//     );

//     const response = await axios.post(
//       `${SAP_CONFIG.serviceLayerUrl}/BusinessPartners`,
//       customerData,
//       {
//         headers: {
//           "Content-Type": "application/json",
//           Cookie: `B1SESSION=${sessionId}`,
//         },
//       }
//     );

//     console.log("✅ Customer created successfully in SAP B1!");
//     console.log("📄 SAP Response CardCode:", response.data.CardCode);
//     return response.data;
//   } catch (error) {
//     console.error("❌ Error creating customer in SAP B1:", error.message);

//     if (error.response) {
//       console.error("SAP Error Response Status:", error.response.status);
//       console.error(
//         "SAP Error Response Data:",
//         JSON.stringify(error.response.data, null, 2)
//       );

//       if (error.response.data && error.response.data.error) {
//         const sapError = error.response.data.error;
//         console.error("SAP Error Code:", sapError.code);
//         if (sapError.message && sapError.message.value) {
//           console.error("SAP Error Message:", sapError.message.value);
//         }
//       }
//     }

//     // If unauthorized, try to login again and retry once
//     if (error.response && error.response.status === 401) {
//       console.log("Session expired, attempting to login again...");
//       sessionId = null;
//       await getSessionId();
//       return exports.createCustomerInSAP(customerData);
//     }

//     throw new Error(`SAP Error: ${error.message}`);
//   }
// };

// // Get the last customer from SAP B1
// exports.getLastCustomerFromSAP = async () => {
//   try {
//     const sessionId = await getSessionId();
//     console.log("Fetching last customer from SAP B1...");

//     const response = await axios.get(
//       `${SAP_CONFIG.serviceLayerUrl}/BusinessPartners?$top=1&$orderby=CardCode desc&$filter=CardType eq 'cCustomer'`,
//       {
//         headers: {
//           "Content-Type": "application/json",
//           Cookie: `B1SESSION=${sessionId}`,
//         },
//       }
//     );

//     if (
//       response.data &&
//       response.data.value &&
//       response.data.value.length > 0
//     ) {
//       const lastCustomer = response.data.value[0];
//       console.log(`Last customer CardCode: ${lastCustomer.CardCode}`);
//       return lastCustomer;
//     }

//     console.log("No customers found in SAP B1");
//     return null;
//   } catch (error) {
//     if (error.response && error.response.status === 401) {
//       console.log("Session expired, attempting to login again...");
//       sessionId = null;
//       await getSessionId();
//       return exports.getLastCustomerFromSAP();
//     }
//     console.error("Error fetching last customer from SAP:", error.message);
//     throw new Error(`SAP Error: ${error.message}`);
//   }
// };

// // Check if a customer exists in SAP
// exports.checkCustomerExistsInSAP = async (cardCode) => {
//   try {
//     const sessionId = await getSessionId();
//     console.log(`Checking if customer ${cardCode} exists in SAP...`);

//     const response = await axios.get(
//       `${SAP_CONFIG.serviceLayerUrl}/BusinessPartners('${cardCode}')`,
//       {
//         headers: {
//           "Content-Type": "application/json",
//           Cookie: `B1SESSION=${sessionId}`,
//         },
//       }
//     );

//     console.log(`Customer ${cardCode} exists in SAP`);
//     return true;
//   } catch (error) {
//     if (error.response && error.response.status === 404) {
//       console.log(`Customer ${cardCode} does not exist in SAP`);
//       return false;
//     }
//     if (error.response && error.response.status === 401) {
//       console.log("Session expired, attempting to login again...");
//       sessionId = null;
//       await getSessionId();
//       return exports.checkCustomerExistsInSAP(cardCode);
//     }
//     console.error("Error checking customer in SAP:", error.message);
//     throw new Error(`SAP Error: ${error.message}`);
//   }
// };
const axios = require("axios");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// SAP B1 Service Layer Configuration
const SAP_CONFIG = {
  serviceLayerUrl: process.env.SAP_SERVICE_LAYER_URL,
  companyDB: process.env.COMPANY_DB,
  username: process.env.USER_NAME,
  password: process.env.PASSWORD,
};

// Set this to true to enable automatic SAP sync
const ENABLE_SAP_SYNC = true;

// Session management
let sessionId = null;
let sessionTimeout = null;

// In-memory lock to prevent concurrent CardCode generation
let cardCodeGenerationLock = false;
const cardCodeQueue = [];

// Add a simple in-memory counter as additional safety
let lastGeneratedNumber = 0;

// Login to SAP B1 Service Layer and get session ID
async function loginToSAP() {
  try {
    console.log("Logging in to SAP B1 Service Layer...");
    if (sessionTimeout) {
      clearTimeout(sessionTimeout);
    }

    const loginData = {
      CompanyDB: SAP_CONFIG.companyDB,
      UserName: SAP_CONFIG.username,
      Password: SAP_CONFIG.password,
    };

    const response = await axios.post(
      `${SAP_CONFIG.serviceLayerUrl}/Login`,
      loginData,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const cookies = response.headers["set-cookie"];
    if (!cookies) {
      throw new Error("No cookies returned from SAP B1 login");
    }

    const sessionCookie = cookies.find((cookie) =>
      cookie.includes("B1SESSION=")
    );
    if (!sessionCookie) {
      throw new Error("B1SESSION cookie not found");
    }

    sessionId = sessionCookie.split(";")[0].replace("B1SESSION=", "");

    // Set session timeout (25 minutes)
    sessionTimeout = setTimeout(() => {
      sessionId = null;
    }, 25 * 60 * 1000);

    console.log("Successfully logged in to SAP B1 Service Layer");
    return sessionId;
  } catch (error) {
    console.error("Error logging in to SAP B1:", error.message);
    if (error.response) {
      console.error("SAP Error details:", error.response.data);
    }
    throw new Error(`SAP Login Error: ${error.message}`);
  }
}

// Get a valid session ID (login if necessary)
async function getSessionId() {
  if (!sessionId) {
    return await loginToSAP();
  }
  return sessionId;
}

// Helper function to wait for lock release
function waitForLock() {
  return new Promise((resolve) => {
    if (!cardCodeGenerationLock) {
      resolve();
    } else {
      cardCodeQueue.push(resolve);
    }
  });
}

// Helper function to release lock
function releaseLock() {
  cardCodeGenerationLock = false;
  if (cardCodeQueue.length > 0) {
    const nextResolve = cardCodeQueue.shift();
    nextResolve();
  }
}

// Get highest CardCode from both SAP and local database - IMPROVED VERSION
async function getHighestCardCode() {
  let highestFromSAP = 0;
  let highestFromLocal = 0;

  // Try to get highest from SAP
  try {
    const sessionId = await getSessionId();
    console.log("🔍 Checking SAP for highest C#### CardCode...");

    // More reliable SAP query - get more customers and filter in code
    const response = await axios.get(
      `${SAP_CONFIG.serviceLayerUrl}/BusinessPartners?$top=1000&$orderby=CardCode desc&$filter=CardType eq 'cCustomer'`,
      {
        headers: {
          "Content-Type": "application/json",
          Cookie: `B1SESSION=${sessionId}`,
        },
      }
    );

    if (
      response.data &&
      response.data.value &&
      response.data.value.length > 0
    ) {
      // Filter and find the highest numeric CardCode
      for (const customer of response.data.value) {
        // Only process CardCodes that match our pattern exactly
        if (
          customer.CardCode &&
          customer.CardCode.length === 5 &&
          customer.CardCode.startsWith("C")
        ) {
          const match = customer.CardCode.match(/^C(\d{4})$/);
          if (match) {
            const number = parseInt(match[1], 10);
            if (number > highestFromSAP) {
              highestFromSAP = number;
            }
          }
        }
      }
      console.log(`📊 Highest SAP CardCode number: ${highestFromSAP}`);
    }
  } catch (sapError) {
    console.warn("⚠️ Could not fetch from SAP:", sapError.message);
  }

  // Try to get highest from local database
  try {
    const Customer = require("../models/Customer.model");
    console.log("🔍 Checking local database for highest C#### CardCode...");

    const customers = await Customer.find({
      CardCode: { $regex: /^C\d{4}$/ },
    })
      .sort({ CardCode: -1 })
      .limit(100)
      .lean();

    for (const customer of customers) {
      if (customer.CardCode && customer.CardCode.length === 5) {
        const match = customer.CardCode.match(/^C(\d{4})$/);
        if (match) {
          const number = parseInt(match[1], 10);
          if (number > highestFromLocal) {
            highestFromLocal = number;
          }
        }
      }
    }
    console.log(`📊 Highest local CardCode number: ${highestFromLocal}`);
  } catch (localError) {
    console.warn("⚠️ Could not fetch from local database:", localError.message);
  }

  // Return the highest number found, with additional safety check
  const highest = Math.max(
    highestFromSAP,
    highestFromLocal,
    lastGeneratedNumber
  );
  console.log(`🎯 Overall highest CardCode number: ${highest}`);
  return highest;
}

// Generate next CardCode with improved logic - FIXED VERSION
exports.generateNextCardCode = async () => {
  // Wait for any existing generation to complete
  await waitForLock();

  // Acquire lock
  cardCodeGenerationLock = true;

  try {
    console.log("🔄 Generating next CardCode with comprehensive checking...");

    // Get the highest existing CardCode number
    const highestNumber = await getHighestCardCode();

    // Generate next CardCode
    let nextNumber = highestNumber + 1;

    // Ensure we don't go below 1 and don't exceed 9999
    if (nextNumber < 1) nextNumber = 1;
    if (nextNumber > 9999) {
      throw new Error("CardCode limit exceeded - contact administrator");
    }

    let nextCardCode = `C${nextNumber.toString().padStart(4, "0")}`;
    console.log(`🎯 Attempting to generate CardCode: ${nextCardCode}`);

    // Check if this CardCode already exists (with retry logic)
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const existsInSAP = await exports.checkCustomerExistsInSAP(nextCardCode);

      // Also check local database
      let existsInLocal = false;
      try {
        const Customer = require("../models/Customer.model");
        const localCustomer = await Customer.findOne({
          CardCode: nextCardCode,
        });
        existsInLocal = !!localCustomer;
      } catch (err) {
        console.warn("Could not check local database:", err.message);
      }

      if (!existsInSAP && !existsInLocal) {
        // CardCode is available
        lastGeneratedNumber = nextNumber; // Update our safety counter
        console.log(`✅ Generated available CardCode: ${nextCardCode}`);
        return nextCardCode;
      }

      // CardCode exists, try the next one
      attempts++;
      nextNumber++;
      if (nextNumber > 9999) {
        throw new Error("CardCode limit exceeded - contact administrator");
      }
      nextCardCode = `C${nextNumber.toString().padStart(4, "0")}`;
      console.log(
        `⚠️ CardCode exists, trying next: ${nextCardCode} (attempt ${attempts})`
      );
    }

    throw new Error(
      "Could not generate unique CardCode after multiple attempts"
    );
  } catch (error) {
    console.error("❌ Error generating CardCode:", error);

    // FIXED: Improved fallback logic - don't use timestamp
    try {
      // Try to get a safe starting number
      const safeStart = Math.max(1, lastGeneratedNumber + 1);

      // If we still have room in the sequence, use it
      if (safeStart <= 9999) {
        const fallbackCardCode = `C${safeStart.toString().padStart(4, "0")}`;

        // Quick check if this fallback is available
        const fallbackExists = await exports.checkCustomerExistsInSAP(
          fallbackCardCode
        );
        if (!fallbackExists) {
          lastGeneratedNumber = safeStart;
          console.log(`🆘 Using safe fallback: ${fallbackCardCode}`);
          return fallbackCardCode;
        }
      }
    } catch (fallbackError) {
      console.error("❌ Fallback generation failed:", fallbackError);
    }

    // FIXED: Last resort - find next available in sequence instead of random
    try {
      const availableCardCode = await exports.getNextAvailableCardCode(1);
      console.log(`🚨 Using next available CardCode: ${availableCardCode}`);
      return availableCardCode;
    } catch (emergencyError) {
      console.error("❌ Emergency fallback failed:", emergencyError);
    }

    // Ultimate fallback - this should rarely happen
    throw new Error(
      "Unable to generate a unique CardCode. Please check the system."
    );
  } finally {
    // Always release the lock
    releaseLock();
  }
};

// Helper function to get next available CardCode in a specific range
exports.getNextAvailableCardCode = async (startFrom = 1) => {
  for (let i = startFrom; i <= 9999; i++) {
    const cardCode = `C${i.toString().padStart(4, "0")}`;
    const exists = await exports.checkCustomerExistsInSAP(cardCode);

    if (!exists) {
      // Also check local database
      try {
        const Customer = require("../models/Customer.model");
        const localCustomer = await Customer.findOne({ CardCode: cardCode });
        if (!localCustomer) {
          lastGeneratedNumber = i; // Update our safety counter
          return cardCode;
        }
      } catch (err) {
        console.warn("Could not check local database:", err.message);
        lastGeneratedNumber = i; // Update our safety counter
        return cardCode; // Return if we can't check local
      }
    }
  }

  throw new Error("No available CardCode found in range C0001-C9999");
};

// Helper function to validate CardCode format
exports.validateCardCode = (cardCode) => {
  if (!cardCode || typeof cardCode !== "string") {
    return false;
  }

  // Must be exactly 5 characters: C followed by 4 digits
  const regex = /^C\d{4}$/;
  return regex.test(cardCode);
};

// Format customer data for SAP B1 - WORKING VERSION based on your diagnostics
exports.formatCustomerForSAP = async (customer) => {
  // Based on your successful tests, this is the working format:
  const sapCustomer = {
    CardCode: customer.CardCode || "",
    CardName: customer.CardName,
    CardType: "cCustomer",
    GroupCode: 100, // This exists in your system and works
    Currency: "AED", // This works in your system
  };

  // Add optional fields only if they have values
  if (customer.Email) {
    sapCustomer.EmailAddress = customer.Email;
  }

  if (customer.phoneNumber) {
    sapCustomer.Phone1 = customer.phoneNumber;
  }

  // Add additional phone number if available
  if (
    customer.additionalPhoneNumbers &&
    customer.additionalPhoneNumbers.length > 0
  ) {
    sapCustomer.Phone2 = customer.additionalPhoneNumbers[0];
  }

  // Add notes if available
  if (customer.notes) {
    sapCustomer.Notes = customer.notes;
  }

  // Add status fields
  sapCustomer.Valid = "tYES";
  sapCustomer.Frozen = "tNO";

  // Add contact persons if we have detailed contact info
  if (customer.firstName || customer.lastName) {
    sapCustomer.ContactEmployees = [
      {
        Name: `${customer.firstName || ""} ${customer.lastName || ""}`.trim(),
        Phone1: customer.phoneNumber || "",
        E_Mail: customer.Email || "",
        Active: "tYES",
      },
    ];
  }

  // Add addresses array if address exists
  if (customer.address && (customer.address.street || customer.address.city)) {
    sapCustomer.BPAddresses = [
      {
        AddressName: "Bill To",
        AddressType: "bo_BillTo",
        Street: customer.address.street || "",
        ZipCode: customer.address.zipCode || "",
        City: customer.address.city || "",
        Country: "FR",
      },
      {
        AddressName: "Ship To",
        AddressType: "bo_ShipTo",
        Street: customer.address.street || "",
        ZipCode: customer.address.zipCode || "",
        City: customer.address.city || "",
        Country: "FR",
      },
    ];
  }

  console.log("✅ Formatted customer for SAP (working configuration):", {
    CardCode: sapCustomer.CardCode,
    CardName: sapCustomer.CardName,
    CardType: sapCustomer.CardType,
    GroupCode: sapCustomer.GroupCode,
    Currency: sapCustomer.Currency,
    EmailAddress: sapCustomer.EmailAddress || "Not provided",
    Phone1: sapCustomer.Phone1 || "Not provided",
  });

  return sapCustomer;
};

// Create a customer in SAP B1 with enhanced error handling
exports.createCustomerInSAP = async (customerData) => {
  try {
    if (!ENABLE_SAP_SYNC) {
      console.log("SAP sync is disabled. Skipping customer creation in SAP.");
      return {
        simulated: true,
        message: "SAP sync is disabled",
        CardCode: customerData.CardCode,
      };
    }

    const sessionId = await getSessionId();
    console.log("Creating customer in SAP B1...");
    console.log(
      "📋 Customer data being sent to SAP:",
      JSON.stringify(customerData, null, 2)
    );

    const response = await axios.post(
      `${SAP_CONFIG.serviceLayerUrl}/BusinessPartners`,
      customerData,
      {
        headers: {
          "Content-Type": "application/json",
          Cookie: `B1SESSION=${sessionId}`,
        },
      }
    );

    console.log("✅ Customer created successfully in SAP B1!");
    console.log("📄 SAP Response CardCode:", response.data.CardCode);
    return response.data;
  } catch (error) {
    console.error("❌ Error creating customer in SAP B1:", error.message);

    if (error.response) {
      console.error("SAP Error Response Status:", error.response.status);
      console.error(
        "SAP Error Response Data:",
        JSON.stringify(error.response.data, null, 2)
      );

      if (error.response.data && error.response.data.error) {
        const sapError = error.response.data.error;
        console.error("SAP Error Code:", sapError.code);
        if (sapError.message && sapError.message.value) {
          console.error("SAP Error Message:", sapError.message.value);
        }
      }
    }

    // If unauthorized, try to login again and retry once
    if (error.response && error.response.status === 401) {
      console.log("Session expired, attempting to login again...");
      sessionId = null;
      await getSessionId();
      return exports.createCustomerInSAP(customerData);
    }

    throw new Error(`SAP Error: ${error.message}`);
  }
};

// Get the last customer from SAP B1
exports.getLastCustomerFromSAP = async () => {
  try {
    const sessionId = await getSessionId();
    console.log("Fetching last customer from SAP B1...");

    const response = await axios.get(
      `${SAP_CONFIG.serviceLayerUrl}/BusinessPartners?$top=1&$orderby=CardCode desc&$filter=CardType eq 'cCustomer'`,
      {
        headers: {
          "Content-Type": "application/json",
          Cookie: `B1SESSION=${sessionId}`,
        },
      }
    );

    if (
      response.data &&
      response.data.value &&
      response.data.value.length > 0
    ) {
      const lastCustomer = response.data.value[0];
      console.log(`Last customer CardCode: ${lastCustomer.CardCode}`);
      return lastCustomer;
    }

    console.log("No customers found in SAP B1");
    return null;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log("Session expired, attempting to login again...");
      sessionId = null;
      await getSessionId();
      return exports.getLastCustomerFromSAP();
    }
    console.error("Error fetching last customer from SAP:", error.message);
    throw new Error(`SAP Error: ${error.message}`);
  }
};

// Check if a customer exists in SAP
exports.checkCustomerExistsInSAP = async (cardCode) => {
  try {
    const sessionId = await getSessionId();
    console.log(`Checking if customer ${cardCode} exists in SAP...`);

    const response = await axios.get(
      `${SAP_CONFIG.serviceLayerUrl}/BusinessPartners('${cardCode}')`,
      {
        headers: {
          "Content-Type": "application/json",
          Cookie: `B1SESSION=${sessionId}`,
        },
      }
    );

    console.log(`Customer ${cardCode} exists in SAP`);
    return true;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.log(`Customer ${cardCode} does not exist in SAP`);
      return false;
    }
    if (error.response && error.response.status === 401) {
      console.log("Session expired, attempting to login again...");
      sessionId = null;
      await getSessionId();
      return exports.checkCustomerExistsInSAP(cardCode);
    }
    console.error("Error checking customer in SAP:", error.message);
    throw new Error(`SAP Error: ${error.message}`);
  }
};
