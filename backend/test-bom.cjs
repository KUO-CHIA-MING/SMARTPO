require('dotenv').config();
const sql = require('mssql');

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function test() {
    try {
        const pool = await sql.connect(config);
        
        // 1. Check if U_ITNM exists in ORDR
        const ordrCheck = await pool.request().query(`
            SELECT TOP 5 DocNum, U_ITNM FROM ORDR WHERE U_ITNM IS NOT NULL
        `);
        console.log('ORDR U_ITNM records:', ordrCheck.recordset);

        // 2. Check ITT1 for BOMs
        const bomCheck = await pool.request().query(`
            SELECT TOP 5 Father, Code FROM ITT1 WHERE Code LIKE '%Z'
        `);
        console.log('ITT1 BOM records (Child ending in Z):', bomCheck.recordset);
        
        // 3. Test the shareable items logic for one item (take a Father from above)
        if (bomCheck.recordset.length > 0) {
            const targetItem = bomCheck.recordset[0].Father;
            console.log(`\nTesting shareable logic for item: ${targetItem}`);
            
            const shareableQuery = await pool.request()
                .input('targetItem', sql.NVarChar, targetItem)
                .query(`
                    DECLARE @Mid14 NVARCHAR(14) = SUBSTRING(@targetItem, 4, 14);
                    DECLARE @Z_Comp NVARCHAR(20) = (SELECT TOP 1 Code FROM ITT1 WHERE Father = @targetItem AND Code LIKE '%Z');

                    SELECT ItemCode, ItemName 
                    FROM OITM 
                    WHERE SUBSTRING(ItemCode, 4, 14) = @Mid14
                       OR ItemCode IN (SELECT Father FROM ITT1 WHERE Code = @Z_Comp)
                       OR ItemCode = @targetItem
                `);
            console.log(`Shareable items for ${targetItem}:`, shareableQuery.recordset.map(r => r.ItemCode));
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

test();
