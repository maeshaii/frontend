/**
 * Verification Script for Export Feature Setup
 * 
 * Run this to verify all dependencies are properly installed
 * Usage: node verify-export-setup.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Export Feature Setup...\n');

// Check if we're in the frontend directory
const currentDir = process.cwd();
if (!currentDir.endsWith('frontend') && !fs.existsSync('./package.json')) {
  console.error('❌ Error: Please run this script from the frontend directory');
  console.error('   cd frontend && node verify-export-setup.js');
  process.exit(1);
}

// Read package.json
let packageJson;
try {
  packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
  console.log('✅ package.json found');
} catch (error) {
  console.error('❌ Error reading package.json:', error.message);
  process.exit(1);
}

// Required dependencies
const requiredDeps = {
  'jspdf': '^3.0.1',
  'jspdf-autotable': 'any',
  'docx': '^9.5.1',
  'file-saver': 'any',
  'exceljs': '^4.4.0',
};

const requiredDevDeps = {
  '@types/file-saver': 'any',
  '@types/jspdf': 'any',
};

console.log('\n📦 Checking Dependencies...\n');

let allDepsInstalled = true;

// Check production dependencies
Object.keys(requiredDeps).forEach(dep => {
  if (packageJson.dependencies && packageJson.dependencies[dep]) {
    console.log(`✅ ${dep}: ${packageJson.dependencies[dep]}`);
  } else {
    console.log(`❌ ${dep}: NOT FOUND`);
    allDepsInstalled = false;
  }
});

// Check dev dependencies
Object.keys(requiredDevDeps).forEach(dep => {
  if (packageJson.devDependencies && packageJson.devDependencies[dep]) {
    console.log(`✅ ${dep}: ${packageJson.devDependencies[dep]}`);
  } else {
    console.log(`⚠️  ${dep}: NOT FOUND (optional)`);
  }
});

// Check if node_modules exist
console.log('\n📁 Checking Installation...\n');

const nodeModulesPath = './node_modules';
if (fs.existsSync(nodeModulesPath)) {
  console.log('✅ node_modules directory exists');
  
  // Check each required package
  Object.keys(requiredDeps).forEach(dep => {
    const depPath = path.join(nodeModulesPath, dep);
    if (fs.existsSync(depPath)) {
      console.log(`✅ ${dep} installed`);
    } else {
      console.log(`❌ ${dep} NOT installed`);
      allDepsInstalled = false;
    }
  });
} else {
  console.log('❌ node_modules directory not found');
  console.log('   Run: npm install');
  allDepsInstalled = false;
}

// Check component file
console.log('\n📄 Checking Component Files...\n');

const componentPath = './src/components/GenerateStatsModal.tsx';
if (fs.existsSync(componentPath)) {
  console.log('✅ GenerateStatsModal.tsx exists');
  
  // Read and check for new imports
  const componentContent = fs.readFileSync(componentPath, 'utf8');
  
  const requiredImports = [
    'jsPDF',
    'autoTable',
    'Document',
    'Packer',
    'saveAs'
  ];
  
  let allImportsFound = true;
  requiredImports.forEach(importName => {
    if (componentContent.includes(importName)) {
      console.log(`✅ Import '${importName}' found`);
    } else {
      console.log(`❌ Import '${importName}' NOT found`);
      allImportsFound = false;
    }
  });
  
  // Check for export functions
  const requiredFunctions = [
    'exportToPDF',
    'exportToWord',
    'handleExportCompleteData'
  ];
  
  requiredFunctions.forEach(funcName => {
    if (componentContent.includes(funcName)) {
      console.log(`✅ Function '${funcName}' found`);
    } else {
      console.log(`❌ Function '${funcName}' NOT found`);
      allImportsFound = false;
    }
  });
  
  if (!allImportsFound) {
    console.log('\n⚠️  Some imports or functions are missing. The component may need to be updated.');
  }
} else {
  console.log('❌ GenerateStatsModal.tsx NOT found');
  console.log('   Expected path: ./src/components/GenerateStatsModal.tsx');
}

// Check documentation
console.log('\n📚 Checking Documentation...\n');

const docs = [
  './EXPORT_FEATURES.md',
  './EXPORT_TESTING_GUIDE.md'
];

docs.forEach(doc => {
  if (fs.existsSync(doc)) {
    console.log(`✅ ${doc} exists`);
  } else {
    console.log(`⚠️  ${doc} NOT found (optional)`);
  }
});

// Final summary
console.log('\n' + '='.repeat(60));
console.log('📊 VERIFICATION SUMMARY\n');

if (allDepsInstalled) {
  console.log('✅ All required dependencies are installed');
  console.log('✅ Setup is complete!');
  console.log('\n🚀 Next Steps:');
  console.log('   1. Start the development server: npm start');
  console.log('   2. Navigate to Admin → Statistics → View Users');
  console.log('   3. Click "Generate Statistics"');
  console.log('   4. Test all three export buttons: Excel, PDF, Word');
  console.log('\n📖 Documentation:');
  console.log('   - See EXPORT_FEATURES.md for feature details');
  console.log('   - See EXPORT_TESTING_GUIDE.md for testing procedures');
} else {
  console.log('❌ Some dependencies are missing');
  console.log('\n🔧 Fix:');
  console.log('   Run: npm install jspdf jspdf-autotable docx file-saver');
  console.log('   Run: npm install --save-dev @types/file-saver');
  console.log('   Then run this verification script again');
}

console.log('='.repeat(60) + '\n');

process.exit(allDepsInstalled ? 0 : 1);





































