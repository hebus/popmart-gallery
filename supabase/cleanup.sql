-- Nettoyage automatique des partages chiffrés expirés (supabase/shares.sql).
-- À exécuter une fois dans Supabase > SQL Editor (rejouable). Prérequis : shares.sql déjà exécuté.
--
-- Sans ce script, les partages expirés ne sont supprimés que lorsqu'un nouveau partage est créé (create_share).
-- Avec lui, une tâche planifiée (pg_cron) les supprime toutes les 30 minutes, même si personne ne partage.
-- Les partages expirés sont de toute façon déjà illisibles (get_share ignore expires_at < now()) : ce nettoyage ne sert
-- qu'à libérer l'espace de stockage de la base gratuite.

create extension if not exists pg_cron with schema pg_catalog;

-- Une tâche portant ce nom est remplacée (rejouable sans doublon).
select cron.schedule(
  'popmart-purge-shares',
  '*/30 * * * *',
  $$ delete from public.shares where expires_at < now() $$
);

-- Purge immédiate des partages déjà expirés (facultatif) : nombre de lignes supprimées.
with purged as (delete from public.shares where expires_at < now() returning 1)
select count(*) as partages_expires_supprimes from purged;

-- Vérification : la tâche doit apparaître, active.
select jobid, jobname, schedule, active from cron.job where jobname = 'popmart-purge-shares';

-- Pour voir les dernières exécutions (après 30 minutes) :
--   select status, return_message, start_time from cron.job_run_details
--   where jobid = (select jobid from cron.job where jobname = 'popmart-purge-shares') order by start_time desc limit 5;
--
-- Pour supprimer la tâche :
--   select cron.unschedule('popmart-purge-shares');
