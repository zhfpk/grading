# privacy-enhancing grading application 

## Important remarks 

This repository is not intended for productive use! 
We added the trusted private signing key for the service provider to this repository to simplify deployment for this peer review scenario. 
This key is different from the key deployed in our setting. 
A key will not be included in the open-source release. 


## Usage 

### Grading client-side application 

We use [Vue.js](https://vuejs.org/) for our client-side application. 
We already included the compiled and minified files in the server directory for easier use. 

To build the source code, we use npm 11.7 with [vite.js](https://vite.dev/guide/). 
The npm dependencies are provided in the `package.json` file. 
Upon successful build, the files `main.min.js` and `main.min.css` are created. 
Those files must be provided in the corresponding `static` directory of the server. 

### Grading application server 

To run the server, you must complete the following steps: 

1. Install Python 3.14 and the required dependencies in `requirements.txt`. 
2. Optional: Build the client-side application as described above. 
3. Run a [flask](https://flask.palletsprojects.com/en/stable/quickstart/) server using `flask run` from within the directory `deployable-server`
4. Assuming default configuration, use the following personal access links to access the already imported exam

    a. For the service provider: http://127.0.0.1:5000/grading/welcome?exam=grading-example-exam&uuid=2aa98b063eb65f8cb5180a8adf6be87ffa144c5df297937c4665747971233f75#eece4b04480e1e60a2f6012e4be84e369d2459bc77fa7a7675cb5e04bbd743df_a0ad5cabaf18a6da644397db6e134c44397c91fc7696e0ed70d0956e5e10f61f

    b. For the official examiner: http://127.0.0.1:5000/grading/welcome?exam=grading-example-exam&uuid=61bd3170d1fbe332bd4ec7a49a217b7d74357099589e1393ebf954e5e031f647#dbf319d2a7bfbc731434a91771d3cd217e018797c7ccbf7d5160b973564121a1_c3e08d428bb804c34eea7926fd76ff3360479a281e035ff2f254997201ab7a3f

    c. For a grader without access to the personal data: http://127.0.0.1:5000/grading/welcome?exam=grading-example-exam&uuid=1bfd973558e81284bf75b37109464974e0123349d718d97573e22176b157d077#f20bf220a8b8d25861a048d1d34ad8c222961ffa8e3a048bfc12cb17dbbeaff0_e76c3a3ce46e9389cf00bc8a089f7eeee7db7ee8ba56dd1fc1d0700fd40fd549
    
    d. For a reassessment grader: http://127.0.0.1:5000/grading/welcome?exam=grading-example-exam&uuid=b8ebfb474dd0610e4bea7f710a49793f94dd4fc257c7bd18351ef42ed7c34f80#038b26ade280ddc74d570b077d6ed361b9e8a63def3cbc47de70453b572c7d8f_0a09537761b4e68b5589a30f0641a386178e2065bd4fe99a35bc70541490fec3

Note: All links contain the corresponding user's credentials for demo purposes. The personal access links usually remain secret. 

The current backend uses the file system to store the encrypted data. Of course, we could also use a database with corresponding tables to potentially speed up server-side processing. The production server caches files so no read delay is noticeable and using the file system simplifies deployment for this scenario yet is not required by design. 

### Importing an exam 

As there will be only local deployment, we added the code of the importer into the `deployable-server`. 
We additionally added the importable exam containing fake personal data to the `deployable-server`. 

Neither is done in productive use as the server is not allowed to learn any personal data and secrets used for encryption / signing. 

We already imported an examination for simplicity. 
In case you want to (re-)import an examination, run the Python script `import-script.py`. 

## Auxiliary material 

We additionally provide the 

- questions for the examinees that were part of the examination feedback
- raw data of the relevant questionnaire responses with the examinees
- tasks used in the think-aloud 
- example examination containing fake data used in the think-aloud (equivalent to the imported examination in the server files)
- questions and results of the SUS questionnaire given to graders in the real-world study 
- raw performance timing measurements gathered manually 


## AI usage declaration

This project was created **without** the use of generative AI (e.g., LLMs). 
Instead, the code was solely written by humans. 


## License 

This code is provided for peer review purposes only. 
Redistribution or reuse is not permitted until the project is officially released. 
A corresponding open-source license will be applied upon publication.
