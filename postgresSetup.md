Go to supabase create account

1. CREATE ORGANISATION
   https://supabase.com/ create an account in this and add the following organisation details
   Add name
   type = educational
   PLAN = FREE
   Click create organisation

2. create project
   set project name
   db password - copy and save this for later use
   select free option
   set region to asia pasific
   dont touch security settings and advance configs
   Click create project

3.Setting up connection

![alt text](image.png)

click on the link under the name of the project
set the settings to the following
![alt text](image-1.png)
set the method to - session pooler and copy the connection URL
iss something like postgresql://....

4. SET UP env

IF U DONT HAVE A .ENV FILE (NOT SAMEPLE ENV), ASK CHAT TO CREATE A .env FILE BASED ON THE INFORMATION IN THE SAMPLE FILE

go to .env file and create variable named POSTGRES_URL
add = sign (no spaces) and past the URL
Goback to supabase and click on the page we used to copy the URL
on the bottom left of the pop up there is an option to reset password. reset the password and copy the new password
go back to the copied url in the env file and then add the password in the place that says, [YOUR-PASSWORD] (get rid of the square brackets as well)
example string postgresql://postgres.dbname:password1234@aws-1-ap-south-1.pooler.supabase.com:5432/postgres

run the backend again without running the docker commands, it should work.

5. SETTING UP DB SCHEMA
   Click on the side bar of the dashboard and find the SQL editor
   click on that and load the SQL editor
   first type in this command:
   create extension if not exists pgcrypto;
   click run , you should see success response in the results
   then go to the script file in the codebase and find the init-db.sql file
   copy the entire file and paste it in a new query
   run it
   you should get a success response
